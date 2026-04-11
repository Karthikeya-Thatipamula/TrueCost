"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLink, IndianRupee, Loader2, Tag } from "lucide-react";
import Link from "next/link";

export default function SearchResults({
  results = [],
  onTrack,
  trackingUrl,
  isTracking,
}) {
  if (!results.length) return null;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-left">
      {results.map((result) => {
        const activeTrack = isTracking && trackingUrl === result.url;

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
                {result.currency === "INR" ? (
                  <IndianRupee className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{result.currency}</span>
                )}
                {result.price.toLocaleString("en-IN")}
              </p>
            </CardContent>

            <CardFooter className="gap-2 flex-wrap">
              <Button size="sm" className="flex-1" onClick={() => onTrack(result.url)} disabled={activeTrack || isTracking}>
                {activeTrack ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Tracking...
                  </>
                ) : (
                  "Track This Price"
                )}
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
  );
}
