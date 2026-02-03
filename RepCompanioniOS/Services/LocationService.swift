import Foundation
import CoreLocation
import MapKit
import Combine

struct NearbyGym: Identifiable {
    let id = UUID()
    let name: String
    let address: String?
    let latitude: Double
    let longitude: Double
    let distance: Double // in meters
    let apiGymId: String? // If from our backend
    let isRepCompanionGym: Bool
}

struct AddressSuggestion: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
}

class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()
    
    private let locationManager = CLLocationManager()
    private let completer = MKLocalSearchCompleter()
    
    @Published var userLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus?
    @Published var nearbyGyms: [NearbyGym] = []
    @Published var suggestions: [AddressSuggestion] = []
    @Published var isSearching = false
    
    var searchQuery = "" {
        didSet {
            completer.queryFragment = searchQuery
        }
    }
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        authorizationStatus = locationManager.authorizationStatus
        
        completer.delegate = self
        completer.resultTypes = .address
    }
    
    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }
    
    func startUpdatingLocation() {
        locationManager.startUpdatingLocation()
    }
    
    func stopUpdatingLocation() {
        locationManager.stopUpdatingLocation()
    }
    
    func searchNearbyGyms(radiusKm: Double = 50.0) {
        guard let location = userLocation else { 
            requestPermission()
            return 
        }
        
        isSearching = true
        self.nearbyGyms = [] // Clear previous results
        
        let dispatchGroup = DispatchGroup()
        var apiGyms: [NearbyGym] = []
        var appleGyms: [NearbyGym] = []
        
        // 1. Fetch from RepCompanion API
        dispatchGroup.enter()
        Task {
            do {
                print("[LocationService] 🌍 Fetching nearby gyms from API with radius \(radiusKm)km...")
                let apiResponse = try await APIService.shared.fetchNearbyGyms(
                    lat: location.coordinate.latitude,
                    lng: location.coordinate.longitude,
                    radiusKm: radiusKm
                )
                
                apiGyms = apiResponse.map { gym in
                    let lat = Double(gym.latitude ?? "0") ?? 0
                    let lng = Double(gym.longitude ?? "0") ?? 0
                    
                    return NearbyGym(
                        name: gym.name,
                        address: gym.location,
                        latitude: lat,
                        longitude: lng,
                        distance: gym.distance * 1000, // API returns km, we want meters for consistency
                        apiGymId: gym.id,
                        isRepCompanionGym: gym.isVerified ?? false
                    )
                }
                print("[LocationService] ✅ API found \(apiGyms.count) gyms")
            } catch {
                print("[LocationService] ❌ API fetch failed: \(error)")
            }
            dispatchGroup.leave()
        }
        
        // 2. Fetch from Apple Maps (Generic)
        dispatchGroup.enter()
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "gym"
        // Convert km to meters for Apple Maps region
        let searchRegionMeters = radiusKm * 1000.0
        request.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: searchRegionMeters, longitudinalMeters: searchRegionMeters)
        
        let search = MKLocalSearch(request: request)
        search.start { response, error in
            if let error = error {
                print("[LocationService] 🗺️ Apple Maps search error: \(error.localizedDescription)")
            }
            
            if let mapItems = response?.mapItems {
                appleGyms = mapItems.compactMap { item in
                    // Use placemark.location which is the standard way to get the coordinate
                    guard let gymLocation = item.placemark.location else { return nil }
                    let distance = location.distance(from: gymLocation)
                    
                    return NearbyGym(
                        name: item.name ?? "Unknown gym",
                        address: item.placemark.title, 
                        latitude: gymLocation.coordinate.latitude,
                        longitude: gymLocation.coordinate.longitude,
                        distance: distance,
                        apiGymId: nil,
                        isRepCompanionGym: false
                    )
                }
                print("[LocationService] 🗺️ Apple Maps found \(appleGyms.count) gyms items")
            }
            dispatchGroup.leave()
        }
        
        // 3. Merge and Update UI
        dispatchGroup.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            self.isSearching = false
            
            // Filter Apple gyms by strict circular radius
            let radiusMeters = radiusKm * 1000.0
            let filteredAppleGyms = appleGyms.filter { $0.distance <= radiusMeters }
            
            // Merge results: RepCompanion gyms always take precedence
            var mergedGyms = apiGyms
            
            // For each Apple gym, check if it's already represented in apiGyms
            for appleGym in filteredAppleGyms {
                let isDuplicate = apiGyms.contains { apiGym in
                    // Proximity check: If coordinates are within 150m
                    let apiLoc = CLLocation(latitude: apiGym.latitude, longitude: apiGym.longitude)
                    let appleLoc = CLLocation(latitude: appleGym.latitude, longitude: appleGym.longitude)
                    let distBetween = apiLoc.distance(from: appleLoc)
                    
                    if distBetween < 150 { return true }
                    
                    // Name match check: If names are very similar and distance is reasonably close
                    if distBetween < 500 {
                        let apiName = apiGym.name.lowercased()
                        let appleName = appleGym.name.lowercased()
                        if apiName.contains(appleName) || appleName.contains(apiName) {
                            return true
                        }
                    }
                    
                    return false
                }
                
                if !isDuplicate {
                    mergedGyms.append(appleGym)
                }
            }
            
            // Final sort by distance
            self.nearbyGyms = mergedGyms.sorted(by: { $0.distance < $1.distance })
            print("[LocationService] 🏁 Final merged list has \(self.nearbyGyms.count) gyms")
        }
    }
}

extension LocationService: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            locationManager.startUpdatingLocation()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        userLocation = locations.last
        // If we have nearby gyms, we might want to refresh if location changed significantly
    }
}

extension LocationService: MKLocalSearchCompleterDelegate {
    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        DispatchQueue.main.async {
            self.suggestions = completer.results.map { 
                AddressSuggestion(title: $0.title, subtitle: $0.subtitle)
            }
        }
    }
    
    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        print("Completer failed: \(error.localizedDescription)")
    }
}
