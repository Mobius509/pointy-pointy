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
    let emoji: String? // shown on the goal ring
}

struct Milestone: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let points: Int
    let emoji: String? // shown on the goal ring
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
    enum State: String, Codable {
        case done, missed, today, upcoming
        case rest // a weekend in a streak that skips them

        // A state a newer server adds reads as "still to come".
        init(from decoder: Decoder) throws {
            self = State(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .upcoming
        }
    }
    let day: String // YYYY-MM-DD
    let state: State
}

/// The kid's arcade: tickets, and what using one does right now.
struct ArcadeInfo: Codable, Hashable {
    struct Playing: Codable, Hashable {
        let game: String
        let name: String?
        let icon: String?
        let art: String? // the game's 3D icon (a site path)
    }
    let tickets: Int
    let mode: String // "locked" | "random" | "pick"
    let playing: Playing?
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
    let arcade: ArcadeInfo?
}

struct KidSettings: Codable {
    /// "HH:MM" (24h) in the household's timezone, or nil when off.
    var reminderTime: String?
    /// The kid's color (0–359).
    var hue: Int?
}
