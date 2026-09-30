import SwiftUI

/// "Who's here?" — pick a kid, then enter their PIN.
struct KidPickerView: View {
    @Environment(AppModel.self) private var model
    @State private var selectedKid: KidSummary?

    private let columns = [GridItem(.adaptive(minimum: 130), spacing: 16)]

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Who's here?")
                    .font(.rounded(32, .medium))
                    .foregroundStyle(Theme.orange)
                    .padding(.top, 40)

                if let household = model.household {
                    if household.kids.isEmpty {
                        Card {
                            Text("A parent hasn't set up any kids yet. Ask them to log in and add you!")
                                .font(.rounded(16))
                                .foregroundStyle(Theme.orange)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        // A lone kid gets a centered tile instead of a half-empty grid row.
                        LazyVGrid(columns: household.kids.count == 1
                                  ? [GridItem(.fixed(180))] : columns, spacing: 16) {
                            ForEach(household.kids) { kid in
                                Button { selectedKid = kid } label: {
                                    KidTile(kid: kid, avatarURL: model.link?.resolve(kid.avatarUrl))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                } else if let error = model.errorMessage {
                    ErrorBanner(message: error)
                } else {
                    ProgressView().padding(40)
                }

                Button("Use a different family link") { model.forgetHousehold() }
                    .font(.rounded(14, .semibold))
                    .foregroundStyle(Theme.sand)
                    .padding(.top, 12)
            }
            .padding(24)
            .frame(maxWidth: 600)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.loadHousehold() }
        .task {
            if model.household == nil { await model.loadHousehold() }
        }
        .sheet(item: $selectedKid) { kid in
            PinEntryView(kid: kid)
                .presentationDetents([.large])
        }
    }
}

private struct KidTile: View {
    let kid: KidSummary
    let avatarURL: URL?

    var body: some View {
        VStack(spacing: 8) {
            AvatarImage(url: avatarURL, size: 96)
            Text(kid.name)
                .font(.rounded(18, .bold))
                .foregroundStyle(Theme.orange)
                .lineLimit(1)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(.white, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}
