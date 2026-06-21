import VideoDetail from "./VideoDetail";

// Server component: in Next 16 `params` is async. We await it and hand the id
// to the client component that does the data fetching + playback.
export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideoDetail id={id} />;
}
