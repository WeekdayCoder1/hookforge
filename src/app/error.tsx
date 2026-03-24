"use client";

export default function GlobalError({ error }: { error: Error }) {
  console.error(error);

  return (
    <div className="p-10 text-white">
      <h1>Something broke 😭</h1>
      <pre>{error.message}</pre>
    </div>
  );
}