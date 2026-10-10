import ViewerLoading from "@/components/viewer/ViewerLoading";

/** Shown while the viewer reads the tile catalog. */
export default function Loading() {
  return (
    <main className="relative h-dvh flex-1 bg-stone-950">
      <ViewerLoading />
    </main>
  );
}
