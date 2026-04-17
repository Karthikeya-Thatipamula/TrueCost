"use client";

import { useState } from "react";
import { addProduct, smartSearchProducts } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchResults from "./SearchResults";
import { Loader2, Search, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState("url");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const ensureAuth = () => {
    if (user) return true;
    setShowAuthModal(true);
    return false;
  };

  const trackUrl = async (productUrl) => {
    if (!ensureAuth()) return;

    setTrackingUrl(productUrl);
    setLoading(true);

    const formData = new FormData();
    formData.append("url", productUrl);

    const result = await addProduct(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message || "Product tracked successfully!");
    }

    setLoading(false);
    setTrackingUrl("");
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();

    if (!ensureAuth()) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("url", url);

    const result = await addProduct(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message || "Product tracked successfully!");
      setUrl("");
    }

    setLoading(false);
  };

  const handleSmartSearch = async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;

    if (!searchQuery.trim()) {
      toast.error("Please enter a product name to search.");
      return;
    }

    setSearching(true);
    const result = await smartSearchProducts(searchQuery);
    if (result?.error) {
      toast.error(result.error);
      setSearchResults([]);
    } else {
      setSearchResults(result.results || []);
      toast.success("Deals fetched successfully.");
    }
    setSearching(false);
  };

  return (
    <>
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant={mode === "url" ? "default" : "outline"}
            className={mode === "url" ? "bg-orange-500 hover:bg-orange-600" : ""}
            onClick={() => setMode("url")}
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            Paste URL
          </Button>
          <Button
            type="button"
            variant={mode === "search" ? "default" : "outline"}
            className={mode === "search" ? "bg-orange-500 hover:bg-orange-600" : ""}
            onClick={() => setMode("search")}
          >
            <Search className="mr-2 h-4 w-4" />
            Search Product
          </Button>
        </div>

      {mode === "url" ? (
      <form onSubmit={handleUrlSubmit} className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste product URL (Amazon, Walmart, etc.)"
            className="h-12 text-base"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 h-10 sm:h-12 px-8"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Track Price"
            )}
          </Button>
        </div>
      </form>
      ) : (
        <form onSubmit={handleSmartSearch} className="w-full max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products (e.g. HP Laptop, Nike Shoes)"
              className="h-12 text-base"
              required
              disabled={searching}
            />
            <Button
              type="submit"
              disabled={searching}
              className="bg-orange-500 hover:bg-orange-600 h-10 sm:h-12 px-8"
              size="lg"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Find Best Deals"
              )}
            </Button>
          </div>
        </form>
      )}

      {mode === "search" && (
        <SearchResults
          results={searchResults}
          onTrack={trackUrl}
          isTracking={loading}
          trackingUrl={trackingUrl}
        />
      )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
