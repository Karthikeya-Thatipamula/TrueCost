"use client";

import { useMemo, useState } from "react";
import { saveUserPreferences } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHOD_OPTIONS = [
  "HDFC Credit Card",
  "SBI Debit Card",
  "Axis Credit Card",
  "UPI",
  "ICICI Credit Card",
  "Amazon Pay",
];

const CATEGORY_OPTIONS = [
  "Mobiles",
  "Laptops",
  "Fashion",
  "Electronics",
  "Home Appliances",
  "Groceries",
];

const SEARCH_PLATFORM_OPTIONS = [
  { label: "Amazon.in", value: "amazon.in" },
  { label: "Flipkart", value: "flipkart.com" },
  { label: "Myntra", value: "myntra.com" },
  { label: "Croma", value: "croma.com" },
  { label: "Reliance Digital", value: "reliancedigital.in" },
];

const DEFAULT_SEARCH_PLATFORMS = ["amazon.in", "flipkart.com", "myntra.com"];

export default function PreferencesButton({ initialPreferences }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultPaymentMethods = useMemo(
    () => initialPreferences?.payment_methods || [],
    [initialPreferences?.payment_methods]
  );
  const defaultFavoriteCategories = useMemo(
    () => initialPreferences?.favorite_categories || [],
    [initialPreferences?.favorite_categories]
  );

  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [favoriteCategories, setFavoriteCategories] = useState(
    defaultFavoriteCategories
  );
  const defaultSearchPlatforms = useMemo(() => {
    if (Array.isArray(initialPreferences?.search_platforms)) {
      return initialPreferences.search_platforms;
    }

    return DEFAULT_SEARCH_PLATFORMS;
  }, [initialPreferences?.search_platforms]);
  const [searchPlatforms, setSearchPlatforms] = useState(defaultSearchPlatforms);

  const toggleSelection = (value, setSelectedValues) => {
    setSelectedValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveUserPreferences({
      payment_methods: paymentMethods,
      favorite_categories: favoriteCategories,
      search_platforms: searchPlatforms,
    });

    if (result?.error) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    toast.success("Preferences saved successfully!");
    setSaving(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Preferences
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Smart Deal Preferences</DialogTitle>
          <DialogDescription>
            Choose how you pay and what you love so we can prioritize better
            deals for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Payment Methods</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((method) => {
                const active = paymentMethods.includes(method);

                return (
                  <Badge
                    key={method}
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      toggleSelection(method, setPaymentMethods)
                    }
                    className={`cursor-pointer px-3 py-1 ${
                      active ? "bg-orange-500 hover:bg-orange-600" : "hover:bg-orange-50"
                    }`}
                  >
                    {method}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Favorite Categories</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => {
                const active = favoriteCategories.includes(category);

                return (
                  <Badge
                    key={category}
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      toggleSelection(
                        category,
                        setFavoriteCategories
                      )
                    }
                    className={`cursor-pointer px-3 py-1 ${
                      active ? "bg-orange-500 hover:bg-orange-600" : "hover:bg-orange-50"
                    }`}
                  >
                    {category}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Search Platforms</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_PLATFORM_OPTIONS.map((platformOption) => {
                const active = searchPlatforms.includes(platformOption.value);

                return (
                  <Badge
                    key={platformOption.value}
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      toggleSelection(
                        platformOption.value,
                        setSearchPlatforms
                      )
                    }
                    className={`cursor-pointer px-3 py-1 ${
                      active ? "bg-orange-500 hover:bg-orange-600" : "hover:bg-orange-50"
                    }`}
                  >
                    {platformOption.label}
                  </Badge>
                );
              })}
            </div>
            {searchPlatforms.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                No platform selected. Smart Search will fallback to Amazon.in + Flipkart.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
