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
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", backgroundColor: "#fafafa" },
  header: { backgroundColor: "#000", color: "#fff", padding: 24, marginBottom: 24, borderRadius: 8 },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 8 },
  url: { fontSize: 12, opacity: 0.8 },
  scoreBox: { marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 16 },
  scoreText: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginTop: 24, marginBottom: 12, borderBottom: "1px solid #eaeaea", paddingBottom: 6 },
  issueCard: { backgroundColor: "#fff", padding: 16, marginBottom: 12, borderRadius: 8, border: "1px solid #eaeaea" },
  issueHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  chip: { fontSize: 8, padding: "4px 8px", borderRadius: 4, marginRight: 8, fontFamily: "Helvetica-Bold", color: "#fff", textTransform: "uppercase" },
  chipCritical: { backgroundColor: "#ef4444" },
  chipMedium: { backgroundColor: "#f59e0b" },
  chipLow: { backgroundColor: "#6b7280" },
  issueTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", flex: 1 },
  fixLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666", marginTop: 8, marginBottom: 4, textTransform: "uppercase" },
  fixSuggestion: { fontSize: 10, color: "#333", lineHeight: 1.5 }
});

function ReportPdf({
  audit
}: {
  audit: { url: string; overallScore: number; issues: Array<{ title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Scrutin Audit Report</Text>
          <Text style={styles.url}>Target: {audit.url}</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreText}>Overall Structural Score: {audit.overallScore}/100</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Actionable Issues</Text>

        {audit.issues.length === 0 ? (
          <Text>No major issues detected.</Text>
        ) : (
          audit.issues.slice(0, 30).map((issue, index) => {
            const severityStyle =
              issue.severity === "critical"
                ? styles.chipCritical
                : issue.severity === "medium"
                ? styles.chipMedium
                : styles.chipLow;

            return (
              <View key={`${issue.title}-${index}`} style={styles.issueCard} wrap={false}>
                <View style={styles.issueHeader}>
                  <Text style={[styles.chip, severityStyle]}>{issue.severity}</Text>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                </View>
                <Text style={styles.fixLabel}>Remediation Step:</Text>
                <Text style={styles.fixSuggestion}>{issue.fixSuggestion}</Text>
              </View>
            );
          })
        )}
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
      {({ loading }) => <Button variant="secondary">{loading ? "Preparing PDF..." : "Download PDF"}</Button>}
    </PDFDownloadLink>
  );
}