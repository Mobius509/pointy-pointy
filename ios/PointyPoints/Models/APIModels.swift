import Foundation

// Mirrors the JSON returned by the web app's /api/v2/kid/* routes.

struct KidSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    /// Path on the web server, e.g. "/avatars/dog1.png".
    let avatarUrl: String
}

struct HouseholdResponse: Codable {
    struct Household: Codable {
        let name: String
        let slug: String
    }

    let household: Household
    let kids: [KidSummary]
}

struct SessionResponse: Codable {
    let token: String
    let expiresAt: String
}

struct Goal: Codable, Hashable {
    let id: String
    let name: String
    let targetPoints: Int
}

struct Milestone: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let points: Int
}

enum ItemState: String, Codable {
    case open, pending, approved
}

struct ChecklistItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
    let points: Int
    let frequency: String
    var state: ItemState

    /// Label shown under non-daily tasks ("Weekly", "Monthly", …).
    var frequencyLabel: String? {
        switch frequency {
        case "weekly": "Weekly"
        case "biweekly": "Bi-weekly"
        case "monthly": "Monthly"
        case "yearly": "Yearly"
        default: nil
        }
    }
}

struct Proposal: Codable, Identifiable, Hashable {
    let id: String
    let name: String
}

/// A day of this week on the streak card.
struct StreakDay: Codable, Hashable {
    enum State: String, Codable { case done, missed, today, upcoming }
    let day: String // YYYY-MM-DD
    let state: State
}

struct StreakInfo: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let daysRequired: Int
    let bonusPoints: Int
    let days: Int
    let todayDone: Bool
    let nextRewardAt: Int
    let daysToGo: Int
    let week: [StreakDay]?
    let broken: Bool?
}

/// An approval waiting to be celebrated.
struct PendingCelebration: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let points: Int
    let isBonus: Bool
}

struct TodayResponse: Codable {
    let kid: KidSummary
    let goal: Goal?
    let progress: Int
    let milestones: [Milestone]
    var items: [ChecklistItem]
    var pendingProposals: [Proposal]
    // The home (Stats) page — optional so an older server still decodes.
    let streaks: [StreakInfo]?
    let householdName: String?
    let initials: String?
    let hue: Int?
    let greeting: String?
    let pendingCelebration: [PendingCelebration]?
}

struct KidSettings: Codable {
    /// "HH:MM" (24h) in the household's timezone, or nil when off.
    var reminderTime: String?
    /// The kid's color (0–359).
    var hue: Int?
}
