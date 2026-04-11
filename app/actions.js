"use server";

import { createClient } from "@/utils/supabase/server";
import { scrapeProduct } from "@/lib/firecrawl";
import { FirecrawlAppV1 } from "@mendable/firecrawl-js";
import { sendPriceDropAlert } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const firecrawl = new FirecrawlAppV1({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

const SEARCH_PLATFORM_CONFIG = {
  "amazon.in": {
    platform: "Amazon.in",
    url: (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
  },
  "flipkart.com": {
    platform: "Flipkart",
    url: (query) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
  },
  "myntra.com": {
    platform: "Myntra",
    url: (query) => `https://www.myntra.com/${encodeURIComponent(query)}`,
  },
  "croma.com": {
    platform: "Croma",
    url: (query) => `https://www.croma.com/searchB?q=${encodeURIComponent(query)}`,
  },
  "reliancedigital.in": {
    platform: "Reliance Digital",
    url: (query) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(query)}`,
  },
};

const DEFAULT_SEARCH_PLATFORMS = ["amazon.in", "flipkart.com"];

function parseNumericPrice(rawPrice) {
  if (typeof rawPrice === "number") return rawPrice;
  if (typeof rawPrice !== "string") return NaN;
  const normalized = rawPrice.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  return Number(normalized);
}

// Rule-based bank/checkout offers used for True Cost estimates.
const BANK_OFFER_RULES = {
  "HDFC Credit Card": { discountPercent: 5, maxDiscount: 2500 },
  "SBI Debit Card": { discountPercent: 10, maxDiscount: 1500 },
  "Axis Credit Card": { discountPercent: 7.5, maxDiscount: 2000 },
  UPI: { discountPercent: 3, maxDiscount: 500 },
  "ICICI Credit Card": { discountPercent: 6, maxDiscount: 1800 },
  "Amazon Pay": { discountPercent: 4, maxDiscount: 800 },
};

export async function calculateTrueCost(product, userPreferences) {
  const basePrice = Number(product?.price ?? product?.current_price);
  const currency = String(product?.currency || "INR").toUpperCase();
  const paymentMethods = Array.isArray(userPreferences?.payment_methods)
    ? userPreferences.payment_methods
    : [];

  if (!Number.isFinite(basePrice) || basePrice <= 0 || paymentMethods.length === 0) {
    return null;
  }

  // Estimate offer value for each selected payment method.
  const offers = paymentMethods.map((method) => {
    const offerRule = BANK_OFFER_RULES[method] || { discountPercent: 0, maxDiscount: 0 };
    const discountRaw = (basePrice * offerRule.discountPercent) / 100;
    const discountAmount = Math.min(discountRaw, offerRule.maxDiscount);
    const finalPrice = Math.max(0, basePrice - discountAmount);

    return {
      method,
      discountPercent: offerRule.discountPercent,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalPrice: Number(finalPrice.toFixed(2)),
      currency,
    };
  });

  const bestOffer = offers.reduce((best, current) =>
    !best || current.finalPrice < best.finalPrice ? current : best
  , null);

  return {
    basePrice: Number(basePrice.toFixed(2)),
    currency,
    offers,
    trueCost: bestOffer?.finalPrice ?? Number(basePrice.toFixed(2)),
    bestPaymentMethod: bestOffer?.method ?? null,
  };
}

export async function smartSearchProducts(query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return { error: "Please enter a product name to search." };
  }

  try {
    const preferences = await getUserPreferences();
    const selectedDomains = Array.isArray(preferences?.search_platforms)
      ? preferences.search_platforms
      : [];

    const domainTargets = (selectedDomains.length > 0
      ? selectedDomains
      : DEFAULT_SEARCH_PLATFORMS
    ).filter((domain, index, list) => list.indexOf(domain) === index);

    const searchTargets = domainTargets
      .map((domain) => {
        const config = SEARCH_PLATFORM_CONFIG[domain];
        if (!config) return null;

        return {
          domain,
          platform: config.platform,
          url: config.url(normalizedQuery),
        };
      })
      .filter(Boolean);

    if (searchTargets.length === 0) {
      return { error: "No valid platforms selected. Update your preferences and try again." };
    }

    console.log(
      `[SmartSearch] Firecrawl credit usage: scraping ${searchTargets.length} platform(s) -> ${searchTargets
        .map((target) => target.platform)
        .join(", ")}`
    );

    const settledResults = await Promise.allSettled(
      searchTargets.map(async ({ platform, url }) => {
        const result = await firecrawl.scrapeUrl(url, {
          formats: ["extract"],
          extract: {
            prompt: `Extract up to 4 product cards from ${platform} search results for "${normalizedQuery}". Return product name, numeric price, currency (INR when missing), product page URL, and image URL.`,
            schema: {
              type: "object",
              properties: {
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: ["number", "string"] },
                      currency: { type: "string" },
                      url: { type: "string" },
                      image_url: { type: "string" },
                    },
                    required: ["name", "price", "url"],
                  },
                },
              },
              required: ["products"],
            },
          },
        });

        const extracted = Array.isArray(result?.extract?.products)
          ? result.extract.products
          : [];

        return extracted
          .map((item) => ({
            platform,
            searchedPlatforms: searchTargets.map((target) => target.platform),
            name: String(item.name || "").trim(),
            price: parseNumericPrice(item.price),
            currency: String(item.currency || "INR").trim().toUpperCase(),
            url: String(item.url || "").trim(),
            image_url: String(item.image_url || "").trim(),
          }))
          .filter(
            (item) =>
              item.name &&
              item.url &&
              Number.isFinite(item.price) &&
              item.price > 0
          );
      })
    );

    const flattened = settledResults
      .filter((entry) => entry.status === "fulfilled")
      .flatMap((entry) => entry.value);

    const deduped = Array.from(
      new Map(flattened.map((item) => [item.url, item])).values()
    ).slice(0, 12);

    if (deduped.length === 0) {
      return { error: "No products found. Try a different search phrase." };
    }

    const lowestPrice = Math.min(...deduped.map((item) => item.price));
    const results = deduped.map((item) => ({
      ...item,
      isBestDeal: item.price === lowestPrice,
    }));

    return { success: true, results };
  } catch (error) {
    console.error("Smart product search error:", error);
    return { error: error.message || "Failed to search products" };
  }
}

export async function addProduct(formData) {
  const url = formData.get("url");

  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Scrape product data with Firecrawl
    const productData = await scrapeProduct(url);

    if (!productData.productName || !productData.currentPrice) {
      console.log(productData, "productData");
      return { error: "Could not extract product information from this URL" };
    }

    const newPrice = parseFloat(productData.currentPrice);
    const currency = productData.currencyCode || "USD";

    // Check if product exists to determine if it's an update
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, current_price")
      .eq("user_id", user.id)
      .eq("url", url)
      .single();

    const isUpdate = !!existingProduct;

    // Upsert product (insert or update based on user_id + url)
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          user_id: user.id,
          url,
          name: productData.productName,
          current_price: newPrice,
          currency: currency,
          image_url: productData.productImageUrl,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,url", // Unique constraint on user_id + url
          ignoreDuplicates: false, // Always update if exists
        }
      )
      .select()
      .single();

    if (error) throw error;

    // Add to price history if it's a new product OR price changed
    const shouldAddHistory =
      !isUpdate || existingProduct.current_price !== newPrice;

    if (shouldAddHistory) {
      await supabase.from("price_history").insert({
        product_id: product.id,
        price: newPrice,
        currency: currency,
      });
    }

    revalidatePath("/");
    return {
      success: true,
      product,
      message: isUpdate
        ? "Product updated with latest price!"
        : "Product added successfully!",
    };
  } catch (error) {
    console.error("Add product error:", error);
    return { error: error.message || "Failed to add product" };
  }
}

export async function deleteProduct(productId) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getPriceHistory(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("product_id", productId)
      .order("checked_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

export async function getPriceTrend(productId) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_history")
      .select("price, checked_at")
      .eq("product_id", productId)
      .order("checked_at", { ascending: false })
      .limit(2);

    if (error) throw error;

    const entries = data || [];

    if (entries.length === 0) {
      return { trend: "new", percentage: 0, lastChecked: null };
    }

    const [latest, previous] = entries;

    if (!previous || Number(previous.price) === 0) {
      return {
        trend: "new",
        percentage: 0,
        lastChecked: latest.checked_at,
      };
    }

    const latestPrice = Number(latest.price);
    const previousPrice = Number(previous.price);
    const change = ((latestPrice - previousPrice) / previousPrice) * 100;

    return {
      trend: change > 0 ? "up" : "down",
      percentage: Number(Math.abs(change).toFixed(1)),
      lastChecked: latest.checked_at,
    };
  } catch (error) {
    console.error("Get price trend error:", error);
    return { trend: "new", percentage: 0, lastChecked: null };
  }
}

export async function saveUserPreferences(preferences) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const paymentMethods = Array.isArray(preferences?.payment_methods)
      ? preferences.payment_methods
      : [];
    const favoriteCategories = Array.isArray(preferences?.favorite_categories)
      ? preferences.favorite_categories
      : [];
    const searchPlatforms = Array.isArray(preferences?.search_platforms)
      ? preferences.search_platforms
      : [];

    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        payment_methods: paymentMethods,
        favorite_categories: favoriteCategories,
        search_platforms: searchPlatforms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Save user preferences error:", error);
    return { error: error.message || "Failed to save preferences" };
  }
}

export async function getUserPreferences() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("payment_methods, favorite_categories, search_platforms, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return (
      data || {
        payment_methods: [],
        favorite_categories: [],
        search_platforms: [],
        updated_at: null,
      }
    );
  } catch (error) {
    console.error("Get user preferences error:", error);
    return {
      payment_methods: [],
      favorite_categories: [],
      search_platforms: [],
      updated_at: null,
    };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}

export async function checkPricesNow() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id);

    if (productsError) throw productsError;

    let updated = 0;
    let priceDrops = 0;

    for (const product of products || []) {
      try {
        const scrapedData = await scrapeProduct(product.url);
        const hasPrice =
          scrapedData?.currentPrice !== null &&
          scrapedData?.currentPrice !== undefined;

        if (!hasPrice) continue;

        const newPrice = Number(scrapedData.currentPrice);
        const oldPrice = Number(product.current_price);

        if (!Number.isFinite(newPrice) || newPrice === oldPrice) {
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

        if (updateError) continue;

        const { error: historyError } = await supabase.from("price_history").insert({
          product_id: product.id,
          price: newPrice,
          currency: product.currency,
        });

        if (historyError) continue;

        updated += 1;

        if (newPrice < oldPrice) {
          priceDrops += 1;
          if (user.email) {
            await sendPriceDropAlert(user.email, product, oldPrice, newPrice);
          }
        }
      } catch (productError) {
        console.error(`Price check failed for product ${product.id}:`, productError);
      }
    }

    revalidatePath("/");

    return {
      success: true,
      updated,
      priceDrops,
      message: `Checked ${products?.length || 0} product(s). Updated ${updated}, with ${priceDrops} price drop(s).`,
    };
  } catch (error) {
    console.error("Check prices now error:", error);
    return { error: error.message || "Failed to check prices" };
  }
}
