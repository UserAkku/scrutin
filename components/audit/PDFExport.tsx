"use client";

import {
  Document,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { Button } from "@/components/shared/button";

const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontSize: 10, 
    fontFamily: "Helvetica", 
    backgroundColor: "#ffffff", 
    color: "#1c1919" 
  },
  cover: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  coverTitle: { 
    fontSize: 40, 
    fontFamily: "Helvetica-Bold", 
    textTransform: "uppercase", 
    marginBottom: 8,
    color: "#1c1919"
  },
  coverUrl: { 
    fontSize: 14, 
    color: "#1c1919", 
    fontFamily: "Helvetica-Bold",
    marginBottom: 40,
    padding: 8,
    border: "2px solid #1c1919",
    backgroundColor: "#FFD1DC"
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    border: "4px solid #1c1919",
    backgroundColor: "#F2E33A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40
  },
  scoreNumber: {
    fontSize: 56,
    fontFamily: "Helvetica-Bold",
    color: "#1c1919"
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#1c1919",
    marginTop: 4
  },
  pageHeader: {
    borderBottom: "4px solid #1c1919",
    paddingBottom: 16,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#1c1919"
  },
  pageSubtitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1c1919"
  },
  issueCard: { 
    backgroundColor: "#ffffff", 
    padding: 16, 
    marginBottom: 16, 
    border: "3px solid #1c1919"
  },
  issueHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 12 
  },
  chip: { 
    fontSize: 9, 
    padding: "4px 8px", 
    marginRight: 8, 
    fontFamily: "Helvetica-Bold", 
    color: "#1c1919", 
    textTransform: "uppercase",
    border: "2px solid #1c1919"
  },
  chipCritical: { backgroundColor: "#fca5a5" },
  chipMedium: { backgroundColor: "#fcd34d" },
  chipLow: { backgroundColor: "#93c5fd" },
  issueTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", flex: 1, color: "#1c1919" },
  categoryLabel: {
    fontSize: 10,
    color: "#1c1919",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#A7C7E7",
    padding: "4px 8px",
    alignSelf: "flex-start",
    border: "2px solid #1c1919",
    marginBottom: 8
  },
  fixLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1c1919", marginTop: 8, marginBottom: 4, textTransform: "uppercase" },
  fixSuggestion: { fontSize: 11, color: "#333", lineHeight: 1.5, fontFamily: "Helvetica-Bold" }
});

function ReportPdf({
  audit
}: {
  audit: { url: string; overallScore: number; issues: Array<{ category?: string; title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>Structural Audit</Text>
          <Text style={styles.coverUrl}>{audit.url}</Text>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>{audit.overallScore}</Text>
            <Text style={styles.scoreLabel}>Overall Score</Text>
          </View>
          <Text style={{ fontSize: 12, color: "#a0a0b0", textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
            This god-level audit includes deep analysis of performance, SEO, security, accessibility, UX/UI, and technical architecture.
          </Text>
        </View>
      </Page>

      {/* Issues Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Actionable Remediations</Text>
          <Text style={styles.pageSubtitle}>{audit.issues.length} issues found</Text>
        </View>

        {audit.issues.length === 0 ? (
          <Text style={{ color: "#a0a0b0" }}>No major issues detected.</Text>
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
                {issue.category && (
                  <Text style={styles.categoryLabel}>{issue.category}</Text>
                )}
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
  audit: { url: string; overallScore: number; issues: Array<{ category?: string; title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <PDFDownloadLink
      document={<ReportPdf audit={audit} />}
      fileName={`${new URL(audit.url).hostname}-audit-report.pdf`}
    >
      {({ loading }) => (
        <Button variant="secondary" className="gap-2">
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Preparing PDF...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}