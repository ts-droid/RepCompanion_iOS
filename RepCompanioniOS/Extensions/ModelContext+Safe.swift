import Foundation
import SwiftData

/// Extension providing safe fetch and save operations with error logging
/// Replaces try? patterns that silently swallow errors
extension ModelContext {

    /// Safely fetch objects with error logging
    /// - Parameter descriptor: The fetch descriptor
    /// - Returns: Array of fetched objects, or empty array on error
    func safeFetch<T>(_ descriptor: FetchDescriptor<T>) -> [T] where T: PersistentModel {
        do {
            return try fetch(descriptor)
        } catch {
            print("[ERROR] ModelContext.safeFetch failed for \(T.self): \(error.localizedDescription)")
            #if DEBUG
            print("[ERROR] Full error: \(error)")
            #endif
            return []
        }
    }

    /// Safely save the context with error logging
    /// - Returns: true if save succeeded, false otherwise
    @discardableResult
    func safeSave() -> Bool {
        do {
            try save()
            return true
        } catch {
            print("[ERROR] ModelContext.safeSave failed: \(error.localizedDescription)")
            #if DEBUG
            print("[ERROR] Full error: \(error)")
            #endif
            return false
        }
    }

    /// Safely fetch a single object with error logging
    /// - Parameter descriptor: The fetch descriptor
    /// - Returns: The first matching object, or nil on error/no match
    func safeFetchFirst<T>(_ descriptor: FetchDescriptor<T>) -> T? where T: PersistentModel {
        safeFetch(descriptor).first
    }

    /// Safely fetch the count of objects matching descriptor
    /// - Parameter descriptor: The fetch descriptor
    /// - Returns: Count of matching objects, or 0 on error
    func safeFetchCount<T>(_ descriptor: FetchDescriptor<T>) -> Int where T: PersistentModel {
        do {
            return try fetchCount(descriptor)
        } catch {
            print("[ERROR] ModelContext.safeFetchCount failed for \(T.self): \(error.localizedDescription)")
            return 0
        }
    }
}
