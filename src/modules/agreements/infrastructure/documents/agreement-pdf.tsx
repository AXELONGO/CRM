import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  heading: { fontSize: 16, marginBottom: 12 },
  section: { marginBottom: 12 },
  label: { fontSize: 8, color: "#555", marginBottom: 3 },
});

export type AgreementPdfInput = {
  title: string;
  documentNumber: string;
  version: number;
  contentHash: string;
  providerName: string;
  customerName: string;
  sections: Array<{ title: string; content: string }>;
};

export async function renderAgreementPdf(input: AgreementPdfInput) {
  const pdf = (
    <Document title={input.title} author="CRM">
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.heading}>{input.title}</Text>
        <View style={styles.section}>
          <Text style={styles.label}>DOCUMENTO</Text>
          <Text>
            {input.documentNumber} / Version {input.version}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>PARTES</Text>
          <Text>Proveedor: {input.providerName}</Text>
          <Text>Cliente: {input.customerName}</Text>
        </View>
        {input.sections.map((section, index) => (
          <View key={`${index}-${section.title}`} style={styles.section} wrap>
            <Text style={styles.label}>{section.title}</Text>
            <Text>{section.content}</Text>
          </View>
        ))}
        <View style={styles.section}>
          <Text style={styles.label}>HUELLA DEL CONTENIDO</Text>
          <Text>{input.contentHash}</Text>
          <Text>
            Este documento usa aceptación electrónica simple; no constituye firma
            electrónica avanzada ni certificación legal.
          </Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(pdf);
}
