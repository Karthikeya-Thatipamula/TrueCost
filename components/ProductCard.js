"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateTrueCost,
  checkPricesNow,
  deleteProduct,
  getPriceTrend,
  getUserPreferences,
} from "@/app/actions";
import PriceChart from "./PriceChart";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function getSmartAdvice({ trend, percentage, lastChecked, currentPrice, lowestPrice }) {
  const now = Date.now();
  const checkedAt = lastChecked ? new Date(lastChecked).getTime() : now;
  const hoursSinceCheck = (now - checkedAt) / (1000 * 60 * 60);
  const hasLowest = Number.isFinite(lowestPrice) && lowestPrice > 0;
  const isNearLowest = hasLowest && currentPrice <= lowestPrice * 1.03;

  if (hoursSinceCheck > 36) {
    return {
      label: "Wait",
      reason: "Price data is stale. Refresh prices for better confidence.",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (isNearLowest || (trend === "down" && percentage >= 2.5)) {
    return {
      label: "Buy Now",
      reason: isNearLowest
        ? "Current price is very close to its historical low."
        : "Price is actively dropping and looks favorable.",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (trend === "up" && percentage >= 3) {
    return {
      label: "Wait",
      reason: "Price is trending up. Better deals often return after spikes.",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  return {
    label: "Good Deal",
    reason: "Fair price right now, but watch for a deeper drop.",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  };
}

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingPrices, setCheckingPrices] = useState(false);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trueCostLoading, setTrueCostLoading] = useState(true);
  const [lowestPrice, setLowestPrice] = useState(Number(product.current_price));
  const [priceTrend, setPriceTrend] = useState({
    trend: "new",
    percentage: 0,
    lastChecked: null,
  });
  const [trueCost, setTrueCost] = useState(null);
  const router = useRouter();

  const loadPriceTrend = useCallback(
    async () => getPriceTrend(product.id),
    [product.id]
  );

  useEffect(() => {
    let active = true;
    loadPriceTrend().then((trendData) => {
      if (active) {
        setPriceTrend(trendData);
        setLowestPrice(
          Number.isFinite(Number(trendData?.lowestPrice))
            ? Number(trendData.lowestPrice)
            : Number(product.current_price)
        );
        setTrendLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [loadPriceTrend, product.current_price]);

  useEffect(() => {
    let active = true;
    const loadTrueCost = async () => {
      const preferences = await getUserPreferences();
      const hasSavedPreferences =
        Boolean(preferences?.updated_at) &&
        Array.isArray(preferences?.payment_methods) &&
        preferences.payment_methods.length > 0;

      if (!active || !hasSavedPreferences) {
        if (active) {
          setTrueCost(null);
          setTrueCostLoading(false);
        }
        return;
      }

      const calculatedTrueCost = await calculateTrueCost(product, preferences);
      if (active) {
        setTrueCost(calculatedTrueCost);
        setTrueCostLoading(false);
      }
    };

    loadTrueCost();

    return () => {
      active = false;
    };
  }, [product]);

  const smartAdvice = useMemo(
    () =>
      getSmartAdvice({
        trend: priceTrend.trend,
        percentage: priceTrend.percentage,
        lastChecked: priceTrend.lastChecked,
        currentPrice: Number(product.current_price),
        lowestPrice,
      }),
    [priceTrend, product.current_price, lowestPrice]
  );

  const formatLastChecked = (timestamp) => {
    if (!timestamp) return "Last checked: just now";

    const now = new Date();
    const checkedTime = new Date(timestamp);
    const diffMs = now.getTime() - checkedTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `Last checked: ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    }

    if (diffHours < 24) {
      return `Last checked: ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `Last checked: ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  const handleDelete = async () => {
    if (!confirm("Remove this product from tracking?")) return;

    setDeleting(true);
    await deleteProduct(product.id);
  };

  const handleShareDeal = async () => {
    try {
      await navigator.clipboard.writeText(product.url);
      toast.success("Deal link copied to clipboard!");
    } catch {
      toast.error("Could not copy link. Please copy manually.");
    }
  };

  const handleCheckPricesNow = async () => {
    setCheckingPrices(true);
    const result = await checkPricesNow();

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      toast.success(result.message);
      const trendData = await loadPriceTrend();
      setPriceTrend(trendData);
      setLowestPrice(
        Number.isFinite(Number(trendData?.lowestPrice))
          ? Number(trendData.lowestPrice)
          : Number(product.current_price)
      );
      router.refresh();
    }

    setCheckingPrices(false);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex gap-4">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-md border"
            />
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-500">
                {product.currency} {product.current_price}
              </span>
              {trendLoading ? (
                <span className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
              ) : priceTrend.trend === "new" ? (
                <Badge variant="secondary">New</Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className={
                    priceTrend.trend === "down"
                      ? "gap-1 text-green-700 bg-green-50 hover:bg-green-50"
                      : "gap-1 text-red-700 bg-red-50 hover:bg-red-50"
                  }
                >
                  {priceTrend.trend === "down" ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  {priceTrend.percentage}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {trendLoading ? "Checking latest trend..." : formatLastChecked(priceTrend.lastChecked)}
            </p>

            <div className="mt-2 rounded-md border p-2 bg-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                <Badge variant="outline" className={smartAdvice.className}>
                  {smartAdvice.label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-600">{smartAdvice.reason}</p>
            </div>

            {trueCostLoading ? (
              <div className="mt-2 rounded-md border bg-gray-50/70 p-2 animate-pulse">
                <div className="h-3.5 w-36 bg-gray-200 rounded" />
                <div className="mt-2 h-7 w-full bg-gray-200 rounded" />
              </div>
            ) : (
              trueCost && (
                <div className="mt-2 rounded-md border border-green-100 bg-green-50/70 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                    Available Coupons &amp; Offers
                  </p>
                  <p className="text-xs font-medium text-green-800">
                    True Cost: {trueCost.currency}{" "}
                    {trueCost.trueCost.toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {trueCost.offers.map((offer) => (
                      <Badge
                        key={`${product.id}-${offer.method}`}
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
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="gap-1"
          >
            {showChart ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Chart
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Chart
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1">
            <Link href={product.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              View Product
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShareDeal}
            className="gap-1"
          >
            <Share2 className="w-4 h-4" />
            Share Deal
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckPricesNow}
            disabled={checkingPrices}
            className="gap-1"
          >
            <RefreshCw
              className={`w-4 h-4 ${checkingPrices ? "animate-spin" : ""}`}
            />
            Check Prices Now
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        </div>
      </CardContent>

      <CardFooter
        className={`overflow-hidden transition-all duration-500 ease-out ${
          showChart ? "max-h-[360px] opacity-100 pt-0" : "max-h-0 opacity-0 py-0"
        }`}
      >
        <div className="w-full">{showChart ? <PriceChart productId={product.id} /> : null}</div>
      </CardFooter>
    </Card>
  );
}
