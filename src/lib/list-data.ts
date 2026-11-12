/** Retrieve Supabase result sets in batches so its default row cap never hides later pages. */
export async function loadListRows<T>(range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const all: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const { data, error } = await range(from, from + size - 1);
    if (error) throw new Error("Could not load the list. Please refresh and try again.");
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < size) return all;
  }
}
