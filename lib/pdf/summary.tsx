import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { TranscriptSnapshot, TranscriptEntry } from "@/lib/transcript";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  meta: { fontSize: 10, color: "#555", marginBottom: 16 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#EEF",
    padding: 4,
    marginTop: 12,
    marginBottom: 4,
  },
  row: { flexDirection: "row", marginBottom: 4 },
  lane: { width: 70, fontFamily: "Helvetica-Bold", color: "#333" },
  text: { flex: 1 },
  screenshot: { marginTop: 6, marginBottom: 6, maxWidth: 480 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

function laneLabel(lane: TranscriptEntry["lane"]): string {
  switch (lane) {
    case "ai":
      return "AI";
    case "human":
      return "Human";
    case "browser":
      return "Browser";
    case "presenter_note":
      return "Presenter";
    default:
      return "System";
  }
}

function formatTimestamp(ms: number, originMs: number): string {
  const delta = Math.max(0, ms - originMs);
  const s = Math.floor(delta / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

interface SummaryProps {
  snapshot: TranscriptSnapshot;
  targetUrl: string;
}

export function SummaryDocument({ snapshot, targetUrl }: SummaryProps): ReactElement {
  const origin = snapshot.startedAt ?? (snapshot.entries[0]?.at ?? Date.now());
  const durationMin = Math.round(snapshot.durationMs / 60_000);

  const qa = snapshot.entries
    .filter((e) => e.lane === "human" || e.qa)
    .slice(0, 20);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>Demo Summary</Text>
        <Text style={styles.meta}>
          {targetUrl} · {snapshot.sections.length} sections · {durationMin} min
        </Text>

        <Text style={styles.h2}>Sections Demonstrated</Text>
        {snapshot.sections.map((s) => (
          <View key={s.name} style={styles.row}>
            <Text style={styles.lane}>•</Text>
            <Text style={styles.text}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{s.name}</Text>
              {` — ${s.summary}`}
            </Text>
          </View>
        ))}

        {qa.length > 0 && (
          <>
            <Text style={styles.h2}>Questions Raised</Text>
            {qa.map((e) => (
              <View key={e.id} style={styles.row}>
                <Text style={styles.lane}>{formatTimestamp(e.at, origin)}</Text>
                <Text style={styles.text}>{e.text}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.h2}>Full Transcript</Text>
        {snapshot.entries.map((e) => (
          <View key={e.id} wrap={false}>
            {e.section && <Text style={styles.sectionHeader}>Section: {e.section}</Text>}
            <View style={styles.row}>
              <Text style={styles.lane}>
                {formatTimestamp(e.at, origin)} {laneLabel(e.lane)}
              </Text>
              <Text style={styles.text}>{e.text}</Text>
            </View>
            {e.screenshotDataUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={e.screenshotDataUrl} style={styles.screenshot} />
            )}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
