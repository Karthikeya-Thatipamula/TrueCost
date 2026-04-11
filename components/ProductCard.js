"use client";

import { useCallback, useEffect, useState } from "react";
import { checkPricesNow, deleteProduct, getPriceTrend } from "@/app/actions";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProductCard({ product }) {
  const [showChart, setShowChart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingPrices, setCheckingPrices] = useState(false);
  const [priceTrend, setPriceTrend] = useState({
    trend: "new",
    percentage: 0,
    lastChecked: null,
  });
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
      }
    });

    return () => {
      active = false;
    };
  }, [loadPriceTrend]);

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

  const handleCheckPricesNow = async () => {
    setCheckingPrices(true);
    const result = await checkPricesNow();

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      toast.success(result.message);
      const trendData = await loadPriceTrend();
      setPriceTrend(trendData);
      router.refresh();
    }

    setCheckingPrices(false);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
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
              {priceTrend.trend === "new" ? (
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
              {formatLastChecked(priceTrend.lastChecked)}
            </p>
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

      {showChart && (
        <CardFooter className="pt-0">
          <PriceChart productId={product.id} />
        </CardFooter>
      )}
    </Card>
  );
}
