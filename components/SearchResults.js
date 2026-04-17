"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateTrueCost, getUserPreferences } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ExternalLink,
  IndianRupee,
  Loader2,
  SearchX,
  Share2,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function normalizeCurrency(currency) {
  const normalized = String(currency ?? "").trim().toUpperCase();
  return !normalized || normalized.includes("₹") ? "INR" : normalized;
}

function getSearchAdvice(result) {
  const averagePrice = Number(result?.averagePrice ?? result?.price);
  const currentPrice = Number(result?.price);

  if (!Number.isFinite(currentPrice)) {
    return {
      label: "Good Deal",
      reason: "Looks promising based on available search data.",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  const ratio = Number.isFinite(averagePrice) && averagePrice > 0
    ? currentPrice / averagePrice
    : 1;

  if (result?.isBestDeal || ratio <= 0.97) {
    return {
      label: "Buy Now",
      reason: "This is one of the strongest prices in current search results.",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (ratio > 1.03) {
    return {
      label: "Wait",
      reason: "Current result is above the best available deal right now.",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  return {
    label: "Good Deal",
    reason: "Solid price today. Keep tracking for deeper drops.",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  };
}

export default function SearchResults({
  results = [],
  onTrack,
  trackingUrl,
  isTracking,
}) {
  const [trueCostByUrl, setTrueCostByUrl] = useState({});
  const [loadingTrueCost, setLoadingTrueCost] = useState(false);

  const selectedPlatforms = Array.from(
    new Set(
      results.flatMap((result) =>
        Array.isArray(result?.searchedPlatforms) ? result.searchedPlatforms : []
      )
    )
  );

  const enrichedResults = useMemo(() => {
    if (!results.length) return [];
    const averagePrice =
      results.reduce((sum, item) => sum + Number(item.price || 0), 0) / results.length;

    return results.map((result) => ({
      ...result,
      averagePrice,
    }));
  }, [results]);

  const availableOffers = useMemo(() => {
    const offers = [];

    enrichedResults.forEach((result) => {
      const trueCost = trueCostByUrl[result.url];
      if (!trueCost?.offers?.length) return;

      trueCost.offers
        .filter((offer) => offer.discountPercent > 0)
        .forEach((offer) => {
          offers.push({
            id: `${result.url}-${offer.method}`,
            productName: result.name,
            platform: result.platform,
            productUrl: result.url,
            currency: offer.currency || trueCost.currency || "INR",
            method: offer.method,
            discountPercent: offer.discountPercent,
            discountAmount: offer.discountAmount,
            isBest:
              offer.method === trueCost.bestPaymentMethod &&
              Number.isFinite(offer.finalPrice) &&
              Number(offer.finalPrice) === Number(trueCost.trueCost),
          });
        });
    });

    return offers.sort((a, b) => {
      if (a.isBest && !b.isBest) return -1;
      if (!a.isBest && b.isBest) return 1;
      return b.discountPercent - a.discountPercent;
    });
  }, [enrichedResults, trueCostByUrl]);

  useEffect(() => {
    let active = true;

    const loadTrueCosts = async () => {
      if (active) setLoadingTrueCost(true);

      const preferences = await getUserPreferences();
      const hasSavedPreferences =
        Boolean(preferences?.updated_at) &&
        Array.isArray(preferences?.payment_methods) &&
        preferences.payment_methods.length > 0;

      if (!active || !hasSavedPreferences || enrichedResults.length === 0) {
        if (active) {
          setTrueCostByUrl({});
          setLoadingTrueCost(false);
        }
        return;
      }

      const calculated = await Promise.all(
        enrichedResults.map(async (result) => {
          const trueCost = await calculateTrueCost(result, preferences);
          return [result.url, trueCost];
        })
      );

      if (active) {
        setTrueCostByUrl(Object.fromEntries(calculated.filter(([, value]) => value)));
        setLoadingTrueCost(false);
      }
    };

    loadTrueCosts();

    return () => {
      active = false;
    };
  }, [enrichedResults]);

  const handleShareDeal = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Deal link copied to clipboard!");
    } catch {
      toast.error("Could not copy link. Please copy manually.");
    }
  };

  if (!results.length) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/80 px-6 py-10 text-center text-gray-600">
        <SearchX className="mx-auto mb-3 h-10 w-10 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">No deal cards yet.</p>
        <p className="text-sm">Search a product to see smart comparisons and recommendations.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 text-left">
      {selectedPlatforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-gray-600">
            Searching {selectedPlatforms.join(" + ")}
          </Badge>
          {selectedPlatforms.map((platform) => (
            <Badge key={platform} variant="secondary" className="text-xs">
              {platform}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {enrichedResults.map((result) => {
          const activeTrack = isTracking && trackingUrl === result.url;
          const trueCost = trueCostByUrl[result.url];
          const smartAdvice = getSearchAdvice(result);
          const resultCurrency = normalizeCurrency(result.currency);
          const trueCostCurrency = normalizeCurrency(trueCost?.currency);

          return (
            <Card key={result.url} className="h-full border-gray-200">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline" className="text-gray-600">
                    {result.platform}
                  </Badge>
                  {result.isBestDeal && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      <Tag className="h-3 w-3" />
                      Best Deal
                    </Badge>
                  )}
                </div>
                <CardTitle className="line-clamp-2 text-sm md:text-base">
                  {result.name}
                </CardTitle>
              </CardHeader>

              <CardContent>
                {result.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.image_url}
                    alt={result.name}
                    className="mb-3 h-40 w-full rounded-md border object-contain bg-white"
                  />
                ) : null}
                <p className="text-2xl font-bold text-orange-500 flex items-center gap-1">
                  {resultCurrency === "INR" ? (
                    <IndianRupee className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{resultCurrency}</span>
                  )}
                  {result.price.toLocaleString("en-IN")}
                </p>

                <div className="mt-3 rounded-md border p-2 bg-white">
                  <Badge variant="outline" className={smartAdvice.className}>
                    {smartAdvice.label}
                  </Badge>
                  <p className="mt-1 text-xs text-gray-600">{smartAdvice.reason}</p>
                </div>

                {loadingTrueCost ? (
                  <div className="mt-3 rounded-md border bg-gray-50/70 p-2 animate-pulse">
                    <div className="h-3.5 w-32 bg-gray-200 rounded" />
                    <div className="mt-2 h-7 w-full bg-gray-200 rounded" />
                  </div>
                ) : (
                  trueCost && (
                    <div className="mt-3 rounded-md border border-green-100 bg-green-50/70 p-2">
                      <p className="text-xs font-medium text-green-800">
                        True Cost: {trueCostCurrency}{" "}
                        {trueCost.trueCost.toLocaleString("en-IN")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {trueCost.offers.map((offer) => (
                          <Badge
                            key={`${result.url}-${offer.method}`}
                            variant="outline"
                            className={
                              offer.method === trueCost.bestPaymentMethod
                                ? "border-green-600 text-green-700 bg-green-100"
                                : "text-gray-600"
                            }
                          >
                            {offer.method}: {offer.discountPercent}% OFF
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </CardContent>

              <CardFooter className="gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onTrack(result.url)}
                  disabled={activeTrack || isTracking}
                >
                  {activeTrack ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Tracking...
                    </>
                  ) : (
                    "Track This Price"
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShareDeal(result.url)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="sm" asChild>
                  <Link href={result.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 md:p-5">
        <h3 className="text-base md:text-lg font-semibold text-gray-900">
          Available Coupons &amp; Bank Offers for You
        </h3>
        <p className="mt-1 text-xs md:text-sm text-gray-600">
          Personalized from your saved payment preferences and true-cost rules.
        </p>

        {loadingTrueCost ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`offer-skeleton-${index}`} className="rounded-lg border bg-white p-3 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-full rounded bg-gray-200" />
                <div className="mt-2 h-3 w-4/5 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : availableOffers.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableOffers.map((offer) => {
              const offerCurrency = normalizeCurrency(offer.currency);

              return (
                <div
                  key={offer.id}
                  className={`rounded-lg border bg-white p-3 shadow-sm ${
                    offer.isBest
                      ? "border-green-300 bg-green-50/60 ring-1 ring-green-200"
                      : "border-gray-200"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      offer.isBest ? "text-green-800" : "text-gray-900"
                    }`}
                  >
                    {offer.method} → {offer.discountPercent}% OFF
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Save up to {offerCurrency === "INR" ? "₹" : `${offerCurrency} `}
                    {Number(offer.discountAmount || 0).toLocaleString("en-IN")} on this deal.
                  </p>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                    {offer.productName} · {offer.platform}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3 h-7 text-xs">
                    <Link href={offer.productUrl} target="_blank" rel="noopener noreferrer">
                      View Offer
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed bg-white/90 p-3 text-sm text-gray-600">
            No eligible coupon or bank offer found for your current preferences.
          </div>
        )}
      </div>
    </div>
  );
}
