import { assertWahaLiveDisabled, mapWahaStatus } from "../domain/waha";

export class FakeWahaServer {
  constructor() {
    assertWahaLiveDisabled();
  }
  async createSession(session: string) {
    return { name: session, status: mapWahaStatus("STOPPED") };
  }
  async startSession() {
    return { status: mapWahaStatus("SCAN_QR_CODE") };
  }
  async stopSession() {
    return { status: mapWahaStatus("STOPPED") };
  }
  async restartSession() {
    return { status: mapWahaStatus("SCAN_QR_CODE") };
  }
  async logoutSession() {
    return { status: mapWahaStatus("LOGGED_OUT") };
  }
  async getQr() {
    return { contentType: "image/png", bytes: Buffer.from("fake-waha-qr") };
  }
  async getMe() {
    return { id: "fake-session@c.us", pushName: "Simulated account", phone: "***0000" };
  }
  async sendText(chatId: string, text: string) {
    return { id: `fake-waha:${chatId}:${text.length}` };
  }
}
