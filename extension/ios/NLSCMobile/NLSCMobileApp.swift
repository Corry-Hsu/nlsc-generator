import SwiftUI

@main
struct NLSCMobileApp: App {
    var body: some Scene {
        WindowGroup { BrowserView().ignoresSafeArea(.keyboard) }
    }
}

struct BrowserView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        UINavigationController(rootViewController: MapViewController())
    }
    func updateUIViewController(_ controller: UINavigationController, context: Context) {}
}
