"use client";

import { VideosSection } from "@trail/ui/marketing";
import { videos } from "../../data/videos";

export default function VideoShowcases() {
  return <VideosSection content={videos} />;
}
