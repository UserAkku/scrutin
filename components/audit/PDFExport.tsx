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
    backgroundColor: "#E7F664", 
    color: "#2D2323" 
  },
  headerLogo: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 40,
    borderBottomWidth: 4,
    borderBottomColor: "#2D2323",
    borderBottomStyle: "solid",
    paddingBottom: 10,
    color: "#2D2323"
  },
  cover: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  coverCard: {
    backgroundColor: "#C4F0FF",
    borderWidth: 4,
    borderColor: "#2D2323",
    borderStyle: "solid",
    padding: 40,
    alignItems: "center",
    width: "100%",
  },
  coverTitle: { 
    fontSize: 24, 
    fontFamily: "Helvetica-Bold", 
    textTransform: "uppercase", 
    marginBottom: 16,
    color: "#2D2323"
  },
  coverUrl: { 
    fontSize: 16, 
    color: "#2D2323", 
    fontFamily: "Helvetica-Bold",
    marginBottom: 40,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#2D2323",
    borderStyle: "solid",
    padding: "8px 16px",
    textTransform: "uppercase",
  },
  scoreBox: {
    width: 200,
    height: 140,
    borderWidth: 4,
    borderColor: "#2D2323",
    borderStyle: "solid",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  },
  scoreNumber: {
    fontSize: 80,
    fontFamily: "Helvetica-Bold",
    color: "#2D2323",
    marginTop: 10
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#2D2323",
    marginTop: 4
  },
  pageHeader: {
    borderBottomWidth: 4,
    borderBottomColor: "#2D2323",
    borderBottomStyle: "solid",
    paddingBottom: 16,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#2D2323"
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#2D2323",
    backgroundColor: "#FFF9A6",
    padding: "4px 8px",
    borderWidth: 2,
    borderColor: "#2D2323",
    borderStyle: "solid",
  },
  issueCard: { 
    backgroundColor: "#FFFFFF", 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 3,
    borderColor: "#2D2323",
    borderStyle: "solid"
  },
  issueHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 12 
  },
  chip: { 
    fontSize: 10, 
    padding: "4px 10px", 
    marginRight: 12, 
    fontFamily: "Helvetica-Bold", 
    color: "#2D2323", 
    textTransform: "uppercase",
    borderWidth: 2,
    borderColor: "#2D2323",
    borderStyle: "solid",
  },
  chipCritical: { backgroundColor: "#FF4444", color: "#FFFFFF" },
  chipMedium: { backgroundColor: "#FFF9A6" },
  chipLow: { backgroundColor: "#B7FF8B" },
  issueTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", flex: 1, color: "#2D2323", textTransform: "uppercase" },
  categoryLabel: {
    fontSize: 10,
    color: "#2D2323",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#FFCBEB",
    padding: "4px 8px",
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#2D2323",
    borderStyle: "solid",
    marginBottom: 12
  },
  fixLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#2D2323", marginTop: 12, marginBottom: 6, textTransform: "uppercase" },
  fixSuggestion: { fontSize: 12, color: "#4A3C3C", lineHeight: 1.5, fontFamily: "Helvetica" }
});

const cardColors = ["#C4F0FF", "#FFCBEB", "#B7FF8B", "#FFF9A6"];

function ReportPdf({
  audit
}: {
  audit: { url: string; overallScore: number; issues: Array<{ category?: string; title: string; severity: string; fixSuggestion: string }> };
}) {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerLogo}>KRILLO</Text>
        <View style={styles.cover}>
          <View style={styles.coverCard}>
            <Text style={styles.coverTitle}>Website Audit Report</Text>
            <Text style={[styles.coverUrl, { backgroundColor: "#FFCBEB" }]}>{audit.url}</Text>
            
            <View style={[styles.scoreBox, { backgroundColor: "#FFF9A6" }]}>
              <Text style={styles.scoreNumber}>{audit.overallScore}</Text>
            </View>
            <Text style={styles.scoreLabel}>Overall Structural Score</Text>
            
            <Text style={{ fontSize: 12, color: "#2D2323", fontFamily: "Helvetica-Bold", textAlign: "center", maxWidth: 350, lineHeight: 1.5, marginTop: 40, borderTopWidth: 2, borderTopColor: "#2D2323", borderTopStyle: "solid", paddingTop: 20 }}>
              This professional audit includes deep analysis of performance, SEO, security, accessibility, UX/UI, and technical architecture.
            </Text>
          </View>
        </View>
      </Page>

      {/* Issues Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Actionable Remediations</Text>
          <Text style={styles.pageSubtitle}>{audit.issues.length} ISSUES</Text>
        </View>

        {audit.issues.length === 0 ? (
          <View style={[styles.issueCard, { backgroundColor: "#B7FF8B" }]}>
            <Text style={{ color: "#2D2323", fontFamily: "Helvetica-Bold", fontSize: 16 }}>No major issues detected.</Text>
          </View>
        ) : (
          audit.issues.slice(0, 30).map((issue, index) => {
            const severityStyle =
              issue.severity === "critical"
                ? styles.chipCritical
                : issue.severity === "medium"
                ? styles.chipMedium
                : styles.chipLow;
                
            const cardBgColor = cardColors[index % cardColors.length];

            return (
              <View key={`${issue.title}-${index}`} style={[styles.issueCard, { backgroundColor: cardBgColor }]} wrap={false}>
                {issue.category && (
                  <Text style={[styles.categoryLabel, { backgroundColor: "#FFFFFF" }]}>{issue.category}</Text>
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
        <div className="px-4 py-1.5 sm:px-6 sm:py-2 bg-white text-brutal-black font-display text-sm sm:text-base uppercase tracking-wider rounded-lg border-[2px] border-brutal-black hover:bg-[var(--pastel-blue)] transition-colors flex items-center justify-center gap-2 h-full w-full">
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
        </div>
      )}
    </PDFDownloadLink>
  );
}