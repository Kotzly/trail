import { marketingCopy } from "@trail/content";

export function Showcase() {
  const { showcase } = marketingCopy;
  const mediaBase = "https://www.gettrail.net";
  const posterSrc = `${mediaBase}/assets/video-poster-white.jpg`;
  const videoSrc = `${mediaBase}/assets/showcase.mp4`;
  const captionsSrc = `${mediaBase}/assets/showcase.vtt`;

  return (
    <section
      id="showcase"
      className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center reveal"
    >
      <p className="trail-eyebrow">Showcase</p>
      <h2 className="trail-title mt-4">{showcase.title}</h2>
      <p className="trail-copy mt-4 max-w-2xl">{showcase.subtitle}</p>
      <figure className="mt-10 w-full max-w-5xl overflow-hidden rounded-[32px] border border-stroke/40 bg-surface">
        <video
          className="h-auto w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterSrc}
          data-play-on-view="true"
          aria-label="Trail product demo"
        >
          <source src={videoSrc} type="video/mp4" />
          <track
            kind="captions"
            srcLang="en"
            src={captionsSrc}
            label="English captions"
            default
          />
        </video>
      </figure>
    </section>
  );
}
