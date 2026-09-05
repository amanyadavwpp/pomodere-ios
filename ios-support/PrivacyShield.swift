// BEGIN POMODERE PRIVACY SHIELD
import UIKit
import WebKit
import Capacitor

private final class PomoderePrivacyShield {
    private static let shared = PomoderePrivacyShield()
    private var observers: [NSObjectProtocol] = []
    private var covers: [UIWindow: UIView] = [:]
    private var generation = 0

    static func install() {
        shared.startObserving()
    }

    private func startObserving() {
        guard observers.isEmpty else { return }
        let center = NotificationCenter.default
        // Observe both lifecycle models without replacing Capacitor's scene or app delegates.
        for name in [UIApplication.willResignActiveNotification, UIScene.willDeactivateNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.obscureWindows()
            })
        }
        for name in [UIApplication.didBecomeActiveNotification, UIScene.didActivateNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.revealActiveWindows()
            })
        }
    }

    private func obscureWindows() {
        generation += 1
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .filter { !$0.isHidden && $0.windowLevel == .normal }
        for window in windows where covers[window] == nil {
            let cover = UIView(frame: window.bounds)
            cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            cover.backgroundColor = UIColor(red: 249.0 / 255, green: 248.0 / 255, blue: 244.0 / 255, alpha: 1)
            let label = UILabel()
            label.text = "pomodere."
            label.textColor = UIColor(red: 55.0 / 255, green: 64.0 / 255, blue: 50.0 / 255, alpha: 1)
            label.font = UIFont(name: "Georgia", size: 32) ?? UIFont.systemFont(ofSize: 32)
            label.translatesAutoresizingMaskIntoConstraints = false
            cover.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: cover.centerYAnchor)
            ])
            window.addSubview(cover)
            covers[window] = cover
            webView(in: window.rootViewController)?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('pomodere:native-state', {detail: {isActive: false}}));",
                completionHandler: nil
            )
        }
    }

    private func webView(in controller: UIViewController?) -> WKWebView? {
        guard let controller = controller else { return nil }
        if let bridge = controller as? CAPBridgeViewController { return bridge.webView }
        for child in controller.children {
            if let found = webView(in: child) { return found }
        }
        return nil
    }

    private func revealActiveWindows() {
        let expected = generation
        for (window, cover) in covers where window.windowScene?.activationState == .foregroundActive {
            let removeCover: () -> Void = { [weak self, weak window, weak cover] in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    guard let self = self, let window = window, let cover = cover,
                          self.generation == expected,
                          window.windowScene?.activationState == .foregroundActive else { return }
                    cover.removeFromSuperview()
                    self.covers.removeValue(forKey: window)
                }
            }
            if let view = webView(in: window.rootViewController) {
                let script = "window.dispatchEvent(new Event('pomodere:privacy-lock')); window.dispatchEvent(new CustomEvent('pomodere:native-state', {detail: {isActive: true}}));"
                view.evaluateJavaScript(script) { _, _ in removeCover() }
            } else {
                removeCover()
            }
        }
    }
}
// END POMODERE PRIVACY SHIELD