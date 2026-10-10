import Header from "@/components/layout/Header";

/** Shown while the selection page reads the room and tile catalog. */
export default function Loading() {
  return (
    <>
      <Header />
      <main
        aria-busy="true"
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:pb-24"
      >
        <p role="status" className="sr-only">
          Loading rooms and tiles…
        </p>
        <div aria-hidden="true" className="animate-pulse">
          <div className="mb-10 max-w-2xl space-y-4 sm:mb-14">
            <div className="h-3 w-28 rounded bg-stone-200" />
            <div className="h-9 w-full rounded bg-stone-200 sm:h-12" />
            <div className="h-4 w-3/4 rounded bg-stone-200" />
          </div>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-28 rounded-xl border border-stone-200 bg-white" />
              ))}
            </div>
            <div className="h-72 rounded-2xl border border-stone-200 bg-white" />
          </div>
        </div>
      </main>
    </>
  );
}
