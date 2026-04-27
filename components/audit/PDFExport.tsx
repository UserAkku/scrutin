"use client";

import {
  Document,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View
} from "@react-pdf/renderer";
import { Button } from "@/components/shared/button";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 12 },
  row: { marginBottom: 10 },
  chip: { fontSize: 9, marginBottom: 4 }
});

function ReportPdf({
  audit
}: {
  audit: { url: string; overallScore: number; issues: Array<{ title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Scrutin Report</Text>
        <Text style={styles.row}>{audit.url}</Text>
        <Text style={styles.row}>Overall score: {audit.overallScore}</Text>
        {audit.issues.slice(0, 20).map((issue) => (
          <View key={`${issue.title}-${issue.severity}`} style={styles.row}>
            <Text style={styles.chip}>{issue.severity.toUpperCase()}</Text>
            <Text>{issue.title}</Text>
            <Text>{issue.fixSuggestion}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function PDFExport({
  audit
}: {
  audit: { url: string; overallScore: number; issues: Array<{ title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <PDFDownloadLink
      document={<ReportPdf audit={audit} />}
      fileName={`${new URL(audit.url).hostname}-audit-report.pdf`}
    >
      {({ loading }) => <Button variant="secondary">{loading ? "Preparing PDF" : "Export PDF"}</Button>}
    </PDFDownloadLink>
  );
}
