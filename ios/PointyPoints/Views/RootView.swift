import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            Theme.cream.ignoresSafeArea()

            switch model.screen {
            case .connect: ConnectView()
            case .pickKid: KidPickerView()
            case .today: TodayView()
            }
        }
        .animation(.default, value: model.screen)
    }
}
