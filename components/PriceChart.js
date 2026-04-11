"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getPriceHistory } from "@/app/actions";
import { Loader2 } from "lucide-react";

function getChartRecommendation(data) {
  if (!data.length) return "Recommendation: Add more history to unlock a smart signal.";

  const latest = data[data.length - 1]?.price;
  const previous = data[data.length - 2]?.price;
  const lowest = Math.min(...data.map((point) => point.price));
  const nearLowest = latest <= lowest * 1.03;

  if (nearLowest) {
    return "Recommendation: Buy Now — current price is near its all-time low.";
  }

  if (Number.isFinite(previous) && latest > previous) {
    return "Recommendation: Wait — price is climbing compared to the last check.";
  }

  return "Recommendation: Good Deal — fair value right now, keep tracking for a dip.";
}

export default function PriceChart({ productId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const history = await getPriceHistory(productId);

      const chartData = history.map((item) => ({
        date: new Date(item.checked_at).toLocaleDateString(),
        price: parseFloat(item.price),
      }));

      setData(chartData);
      setLoading(false);
    }

    loadData();
  }, [productId]);

  const lowestPrice = useMemo(() => {
    if (!data.length) return null;
    return Math.min(...data.map((item) => item.price));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 w-full">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading chart...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 w-full">
        No price history yet. Check back after the first daily update!
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Price History</h4>
        <p className="text-xs text-gray-600">{getChartRecommendation(data)}</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
            }}
          />
          {lowestPrice !== null && (
            <ReferenceLine
              y={lowestPrice}
              stroke="#10b981"
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
              label={{
                value: `Lowest Ever: ${lowestPrice.toLocaleString("en-IN")}`,
                position: "insideTopLeft",
                fill: "#047857",
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#FA5D19"
            strokeWidth={2}
            dot={{ fill: "#FA5D19", r: 4 }}
            activeDot={{ r: 6 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
