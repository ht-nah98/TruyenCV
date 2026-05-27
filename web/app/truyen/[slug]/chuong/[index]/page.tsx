import { ReaderClient } from "@/components/Reader";

// Tải nội dung động phía client → không pre-render hàng nghìn trang.
export const dynamicParams = true;
export function generateStaticParams() {
  return [] as { slug: string; index: string }[];
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; index: string }>;
}) {
  const { slug, index } = await params;
  return <ReaderClient slug={slug} index={Number(index)} />;
}
