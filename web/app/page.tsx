import { getLibrary } from "@/lib/data";
import { SettingsButton } from "@/components/SettingsPanel";
import { LibraryView } from "@/components/LibraryView";

export default function HomePage() {
  const library = getLibrary();

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <span className="brand">📚 Tủ Truyện</span>
          <span className="spacer" />
          <SettingsButton />
        </div>
      </header>

      <main className="container">
        <h1 style={{ fontSize: 24, margin: "24px 0 4px" }}>Thư viện truyện</h1>
        <p className="progress-note">{library.length} truyện</p>
        <LibraryView library={library} />
      </main>
    </>
  );
}
