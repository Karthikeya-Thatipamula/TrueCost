import { createClient } from "@supabase/supabase-js";
import { scrapeProduct } from "@/lib/firecrawl";
import { sendPriceDropAlert } from "@/lib/email";

function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isAuthorized(request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice("Bearer ".length);
  return token === cronSecret;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Service role client bypasses RLS for trusted server-side cron jobs.
    const supabase = createServiceRoleClient();

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*");

    if (productsError) {
      throw productsError;
    }

    console.log(`Checking ${products.length} products`);

    let updated = 0;
    let priceDrops = 0;

    for (const product of products) {
      console.log(`Checking product ${product.id}: ${product.url}`);

      // Keep each product isolated so one failure doesn't stop the cron run.
      try {
        let scrapedData;

        try {
          scrapedData = await scrapeProduct(product.url);
        } catch (scrapeError) {
          console.error(
            `Scrape failed for product ${product.id} (${product.url}):`,
            scrapeError
          );
          continue;
        }

        const hasPrice =
          scrapedData?.currentPrice !== null && scrapedData?.currentPrice !== undefined;

        if (!hasPrice) {
          console.error(`No currentPrice returned for product ${product.id}`);
          continue;
        }

        const newPrice = Number(scrapedData.currentPrice);
        const oldPrice = Number(product.current_price);

        if (!Number.isFinite(newPrice)) {
          console.error(
            `Invalid scraped price for product ${product.id}:`,
            scrapedData.currentPrice
          );
          continue;
        }

        // Only write when a real change is detected to reduce DB writes on free tier.
        if (newPrice === oldPrice) {
          console.log(`No price change for product ${product.id}`);
          continue;
        }

        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("products")
          .update({
            current_price: newPrice,
            updated_at: now,
          })
          .eq("id", product.id);

        if (updateError) {
          console.error(`Failed to update product ${product.id}:`, updateError);
          continue;
        }

        const { error: historyError } = await supabase.from("price_history").insert({
          product_id: product.id,
          price: newPrice,
          currency: product.currency,
        });

        if (historyError) {
          console.error(
            `Failed to insert price history for product ${product.id}:`,
            historyError
          );
          continue;
        }

        updated += 1;

        if (newPrice < oldPrice) {
          priceDrops += 1;
          console.log(
            `Price dropped for product ${product.id}: ${oldPrice} -> ${newPrice}`
          );

          try {
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.admin.getUserById(product.user_id);

            if (userError) {
              console.error(
                `Failed to fetch user email for product ${product.id}:`,
                userError
              );
              continue;
            }

            if (!user?.email) {
              console.error(`No user email found for product ${product.id}`);
              continue;
            }

            await sendPriceDropAlert(user.email, product, oldPrice, newPrice);
            console.log(`Price drop alert sent for product ${product.id}`);
          } catch (emailError) {
            console.error(
              `Failed to send price drop alert for product ${product.id}:`,
              emailError
            );
          }
        } else {
          console.log(`Price changed (non-drop) for product ${product.id}`);
        }
      } catch (productError) {
        console.error(`Unexpected error for product ${product.id}:`, productError);
      }
    }

    return Response.json({
      success: true,
      totalProducts: products.length,
      updated,
      priceDrops,
    });
  } catch (error) {
    console.error("Cron price check failed:", error);
    return Response.json(
      {
        error: "Failed to check prices",
      },
      { status: 500 }
    );
  }
}
