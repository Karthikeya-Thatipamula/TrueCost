"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Percent, ReceiptText, Sparkles, Tags } from "lucide-react";

const TABS = [
  { id: "comparisons", label: "Comparisons", icon: Sparkles },
  { id: "offers", label: "Offers & Coupons", icon: Tags },
  { id: "fees", label: "Hidden Fees", icon: ReceiptText },
];

function normalizeCurrency(currency) {
  const normalized = String(currency ?? "").trim().toUpperCase();
  return !normalized || normalized.includes("₹") ? "INR" : normalized;
}

function formatMoney(value, currency = "INR") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const normalizedCurrency = normalizeCurrency(currency);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function extractStoreLabel(url) {
  if (!url) return "Unknown";

  try {
    const host = new URL(url).hostname.replace("www.", "");
    return host || "Unknown";
  } catch {
    return "Unknown";
  }
}

export default function DealsHub({ products = [], preferences = null }) {
  const [activeTab, setActiveTab] = useState("comparisons");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [deliveryFee, setDeliveryFee] = useState(49);
  const [taxPercent, setTaxPercent] = useState(5);
  const [platformFeePercent, setPlatformFeePercent] = useState(2);

  const comparisonRows = useMemo(
    () =>
      products.map((product) => {
        const trueCostData = product.trueCost;
        return {
          id: product.id,
          name: product.name,
          store: extractStoreLabel(product.url),
          basePrice: Number(product.current_price ?? product.price ?? 0),
          bestPaymentMethod: trueCostData?.bestPaymentMethod,
          trueCost: trueCostData?.trueCost,
          currency: normalizeCurrency(trueCostData?.currency || product.currency || "INR"),
        };
      }),
    [products]
  );

  const offerHighlights = useMemo(() => {
    const bestByMethod = new Map();

    products.forEach((product) => {
      const offers = Array.isArray(product.trueCost?.offers)
        ? product.trueCost.offers
        : [];

      offers.forEach((offer) => {
        const currentBest = bestByMethod.get(offer.method);
        if (!currentBest || Number(offer.discountAmount) > Number(currentBest.discountAmount)) {
          bestByMethod.set(offer.method, {
            ...offer,
            productName: product.name,
          });
        }
      });
    });

    return Array.from(bestByMethod.values()).sort(
      (a, b) => Number(b.discountAmount) - Number(a.discountAmount)
    );
  }, [products]);

  const selectedRow = comparisonRows.find((row) => String(row.id) === String(selectedProductId));
  const feeBasePrice = Number(selectedRow?.trueCost ?? selectedRow?.basePrice ?? 0);
  const feeCurrency = normalizeCurrency(selectedRow?.currency || "INR");
  const parsedDeliveryFee = Number(deliveryFee) || 0;
  const parsedTaxPercent = Number(taxPercent) || 0;
  const parsedPlatformFeePercent = Number(platformFeePercent) || 0;

  const taxAmount = (feeBasePrice * parsedTaxPercent) / 100;
  const platformFeeAmount = (feeBasePrice * parsedPlatformFeePercent) / 100;
  const trueFinalCost = feeBasePrice + parsedDeliveryFee + taxAmount + platformFeeAmount;

  const preferredMethods = Array.isArray(preferences?.payment_methods)
    ? preferences.payment_methods
    : [];

  return (
    <section className="max-w-7xl mx-auto px-4 pb-10 sm:pb-14">
      <div className="rounded-2xl border border-orange-100 bg-white/95 p-4 sm:p-6 shadow-xs">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Deals Hub</h3>
            <p className="text-sm text-gray-600">
              Compare tracked products, surface top offers, and estimate hidden checkout fees.
            </p>
          </div>
          {preferredMethods.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferredMethods.slice(0, 3).map((method) => (
                <Badge key={method} variant="outline" className="border-orange-200 text-orange-700">
                  {method}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant={activeTab === id ? "default" : "outline"}
              onClick={() => setActiveTab(id)}
              className={`justify-start rounded-xl ${
                activeTab === id
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {activeTab === "comparisons" && (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Store</th>
                  <th className="px-4 py-3 font-semibold">Base Price</th>
                  <th className="px-4 py-3 font-semibold">Best Offer</th>
                  <th className="px-4 py-3 font-semibold">True Cost</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.length > 0 ? (
                  comparisonRows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.store}</td>
                      <td className="px-4 py-3 text-gray-700">{formatMoney(row.basePrice, row.currency)}</td>
                      <td className="px-4 py-3 text-gray-700">{row.bestPaymentMethod || "No offer"}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {row.trueCost ? formatMoney(row.trueCost, row.currency) : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>
                      No tracked products yet. Search a product above or track one by URL.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "offers" && (
          <div className="space-y-3">
            {offerHighlights.length > 0 ? (
              offerHighlights.map((offer) => (
                <div
                  key={`${offer.method}-${offer.productName}`}
                  className="rounded-xl border border-orange-100 bg-orange-50/60 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{offer.method}</p>
                      <p className="text-sm text-gray-600">Best on {offer.productName}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-gray-600">Estimated discount</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatMoney(offer.discountAmount, offer.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-600">
                No eligible offers found from your current tracked products and preferences.
              </div>
            )}
          </div>
        )}

        {activeTab === "fees" && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">Select Product</span>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                  disabled={comparisonRows.length === 0}
                >
                  {comparisonRows.length > 0 ? (
                    comparisonRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No products available</option>
                  )}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">Estimated Delivery Fee</span>
                <Input
                  type="number"
                  value={deliveryFee}
                  min="0"
                  onChange={(event) => setDeliveryFee(event.target.value)}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-gray-700">Tax %</span>
                  <Input
                    type="number"
                    value={taxPercent}
                    min="0"
                    onChange={(event) => setTaxPercent(event.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-gray-700">Platform Fee %</span>
                  <Input
                    type="number"
                    value={platformFeePercent}
                    min="0"
                    onChange={(event) => setPlatformFeePercent(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="mb-1 text-sm font-medium text-emerald-800">Estimated checkout summary</p>
              <h4 className="mb-4 text-xl font-bold text-emerald-900">True Final Cost</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>True Cost Base</span>
                  <span>{formatMoney(feeBasePrice, feeCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Delivery Fee</span>
                  <span>{formatMoney(parsedDeliveryFee, feeCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax ({parsedTaxPercent}%)</span>
                  <span>{formatMoney(taxAmount, feeCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center">
                    Platform Fee ({parsedPlatformFeePercent}%)
                    <Percent className="ml-1 h-3.5 w-3.5" />
                  </span>
                  <span>{formatMoney(platformFeeAmount, feeCurrency)}</span>
                </div>
                <div className="mt-3 border-t border-emerald-200 pt-3 flex items-center justify-between text-base font-semibold text-emerald-900">
                  <span>True Final Cost</span>
                  <span>{formatMoney(trueFinalCost, feeCurrency)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
