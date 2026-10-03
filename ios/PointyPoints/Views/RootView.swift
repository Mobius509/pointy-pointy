import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            Theme.palette.page.ignoresSafeArea()

            switch model.screen {
            case .connect: ConnectView()
            case .pickKid: KidPickerView()
            case .today: KidAppView()
            }
        }
        .animation(.default, value: model.screen)
    }
}
