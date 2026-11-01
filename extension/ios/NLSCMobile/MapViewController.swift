import UIKit
import WebKit

final class MapViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    private var webView: WKWebView!
    private var saving = false
    private let home = URL(string: "https://maps.nlsc.gov.tw/T09/mapshow.action")!
    private var documents: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "NLSC 地號助手"
        let controller = WKUserContentController()
        controller.addScriptMessageHandler(self, contentWorld: .page, name: "nlsc")
        for (name, time) in [("capture-geometry", WKUserScriptInjectionTime.atDocumentStart),
                              ("ios-bridge", .atDocumentStart), ("content", .atDocumentEnd), ("mobile-ui", .atDocumentEnd)] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "js"),
                  let script = try? String(contentsOf: url, encoding: .utf8) else {
                fatalError("缺少必要資源：\(name).js；請先執行同步腳本")
            }
            let guarded = "if(location.origin==='https://maps.nlsc.gov.tw' && location.pathname==='/T09/mapshow.action'){\n" + script + "\n}"
            controller.addUserScript(WKUserScript(source: guarded, injectionTime: time, forMainFrameOnly: true))
        }
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "重新整理", style: .plain, target: self, action: #selector(reload))
        navigationItem.rightBarButtonItems = [
            UIBarButtonItem(title: "檔案", style: .plain, target: self, action: #selector(showFiles)),
            UIBarButtonItem(title: "面板", style: .plain, target: self, action: #selector(recall))
        ]
        webView.load(URLRequest(url: home))
    }

    @objc private func reload() { webView.load(URLRequest(url: home)) }
    @objc private func recall() { webView.evaluateJavaScript("window.NLSCRecallPanel?.()", completionHandler: nil) }
    @objc private func showFiles() {
        let files = ((try? FileManager.default.contentsOfDirectory(at: documents, includingPropertiesForKeys: nil)) ?? [])
            .filter { ["png", "xml"].contains($0.pathExtension) }.sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard !files.isEmpty else { notify("尚無檔案，請先匯出 Excel 或截圖"); return }
        let sheet = UIActivityViewController(activityItems: files, applicationActivities: nil)
        sheet.popoverPresentationController?.barButtonItem = navigationItem.rightBarButtonItems?.first
        present(sheet, animated: true)
    }
    private func notify(_ message: String) {
        let alert = UIAlertController(title: "NLSC", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
    }
    private func allowed(_ url: URL?) -> Bool {
        url?.scheme == "https" && url?.host == "maps.nlsc.gov.tw" && url?.path == "/T09/mapshow.action"
    }
    private func foreground() -> Bool { view.window?.windowScene?.activationState == .foregroundActive }
    private func fileURL(_ filename: String, ext: String) throws -> URL {
        guard filename.hasSuffix("." + ext), filename.count <= 200,
              !filename.contains("/"), !filename.contains("\\"), !filename.hasPrefix("."),
              filename.rangeOfCharacter(from: .controlCharacters) == nil else { throw failure("檔名無效") }
        var url = documents.appendingPathComponent(filename)
        var index = 1
        while FileManager.default.fileExists(atPath: url.path) {
            url = documents.appendingPathComponent("\(String(filename.dropLast(ext.count + 1))) (\(index)).\(ext)")
            index += 1
        }
        return url
    }
    private func failure(_ text: String) -> NSError { NSError(domain: "NLSC", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, allowed(message.frameInfo.request.url), allowed(webView.url), foreground(),
              let body = message.body as? [String: Any], let type = body["type"] as? String else {
            replyHandler(nil, "請在前景的 NLSC 地圖操作"); return
        }
        if type == "check" { replyHandler(["ok": true], nil); return }
        guard !saving else { replyHandler(nil, "正在儲存檔案"); return }
        do {
            if type == "export" {
                guard let text = body["text"] as? String, text.utf8.count < 20_000_000,
                      let filename = body["filename"] as? String else { throw failure("匯出內容無效") }
                try Data(text.utf8).write(to: fileURL(filename, ext: "xml"), options: .atomic)
                replyHandler(["ok": true], nil)
            } else if type == "capture" {
                try capture(body, reply: replyHandler)
            } else { throw failure("不支援的操作") }
        } catch { replyHandler(nil, error.localizedDescription) }
    }

    private func capture(_ body: [String: Any], reply: @escaping (Any?, String?) -> Void) throws {
        guard let r = body["rect"] as? [String: Double], let vp = body["viewport"] as? [String: Double],
              let x = r["x"], let y = r["y"], let w = r["width"], let h = r["height"],
              let width = vp["width"], let height = vp["height"],
              [x, y, w, h, width, height].allSatisfy({ $0.isFinite }),
              width > 0, height > 0, x >= 0, y >= 0, w >= 100, h >= 100,
              x + w <= width + 1, y + h <= height + 1,
              let filename = body["filename"] as? String else { throw failure("截圖範圍無效") }
        let destination = try fileURL(filename, ext: "png")
        let bounds = webView.bounds
        guard abs(bounds.width / width - bounds.height / height) < 0.02 else { throw failure("畫面比例已變更，請重試") }
        let json = try JSONSerialization.data(withJSONObject: vp)
        let expected = String(decoding: json, as: UTF8.self)
        let check = "document.visibilityState==='visible' && NLSCCaptureGeometry.sameViewport(\(expected),NLSCCaptureGeometry.viewport())"
        saving = true
        webView.evaluateJavaScript(check) { [weak self] result, error in
            guard let self = self else { reply(nil, "畫面已關閉"); return }
            guard error == nil, result as? Bool == true, self.foreground() else {
                self.saving = false; reply(nil, "截圖前畫面已變更"); return
            }
            let configuration = WKSnapshotConfiguration()
            configuration.rect = CGRect(x: x * bounds.width / width, y: y * bounds.height / height,
                                        width: w * bounds.width / width, height: h * bounds.height / height)
            configuration.afterScreenUpdates = true
            self.webView.takeSnapshot(with: configuration) { image, error in
                self.webView.evaluateJavaScript(check) { valid, validationError in
                    defer { self.saving = false }
                    guard validationError == nil, valid as? Bool == true, self.foreground(), self.allowed(self.webView.url),
                          self.webView.bounds == bounds else { reply(nil, "截圖期間畫面已變更，未儲存"); return }
                    guard let data = image?.pngData(), error == nil else { reply(nil, error?.localizedDescription ?? "無法取得截圖"); return }
                    do { try data.write(to: destination, options: .atomic); reply(["ok": true], nil) }
                    catch { reply(nil, error.localizedDescription) }
                }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.targetFrame?.isMainFrame != false else { decisionHandler(.allow); return }
        if allowed(navigationAction.request.url) { decisionHandler(.allow) }
        else {
            decisionHandler(.cancel)
            if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
            }
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { notify("網頁載入失敗：\(error.localizedDescription)") }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "國土測繪", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "國土測繪", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
