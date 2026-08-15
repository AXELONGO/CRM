import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4 },
  heading: { fontSize: 18, marginBottom: 14 },
  block: { marginBottom: 12 },
  label: { color: "#555", fontSize: 8, marginBottom: 3 },
});

export type QuotePdfInput = {
  title: string;
  number: string;
  version: number;
  currency: string;
  customerName: string;
  lines: Array<{ description: string; quantity: string; totalMinor: string }>;
  totalMinor: string;
  contentHash: string;
};

export async function renderQuotePdf(input: QuotePdfInput) {
  return renderToBuffer(
    <Document title={input.title} author="CRM">
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.heading}>{input.title}</Text>
        <View style={styles.block}>
          <Text style={styles.label}>DOCUMENTO</Text>
          <Text>
            {input.number} / Version {input.version}
          </Text>
          <Text>Cliente: {input.customerName}</Text>
          <Text>Moneda: {input.currency}</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>PARTIDAS</Text>
          {input.lines.map((line, index) => (
            <Text key={`${index}-${line.description}`}>
              {line.description} | cantidad {line.quantity} | total minor{" "}
              {line.totalMinor}
            </Text>
          ))}
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>TOTAL</Text>
          <Text>
            {input.totalMinor} {input.currency}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>HASH DEL CONTENIDO</Text>
          <Text>{input.contentHash}</Text>
          <Text>Esta es una cotización comercial; no es factura ni CFDI.</Text>
        </View>
      </Page>
    </Document>,
  );
}
