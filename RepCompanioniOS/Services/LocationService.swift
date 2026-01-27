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
            if let mapItems = response?.mapItems {
                appleGyms = mapItems.map { item in
                    // Use modern location property (non-optional CLLocation in newer SDKs)
                    let gymLocation = item.location // inferred as CLLocation
                    let distance = location.distance(from: gymLocation)
                    
                    return NearbyGym(
                        name: item.name ?? "Okänt gym",
                        address: item.placemark.title, 
                        latitude: gymLocation.coordinate.latitude,
                        longitude: gymLocation.coordinate.longitude,
                        distance: distance,
                        apiGymId: nil,
                        isRepCompanionGym: false
                    )
                }
                print("[LocationService] 🗺️ Apple Maps found \(appleGyms.count) gyms")
            }
            dispatchGroup.leave()
        }
        
        // 3. Merge and Update UI
        dispatchGroup.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            self.isSearching = false
            
            // Combine: RepCompanion gyms first, then Apple gyms (Deduplication via distance/name could be added here)
            // For now, simple concatenation
            
            // Sort Apple gyms by distance
            let sortedAppleGyms = appleGyms.sorted(by: { $0.distance < $1.distance })
            
            // Filter out Apple gyms that might be duplicates of API gyms (very rough check by name distance)
            // This is complex, so we'll just stack them for now, API first.
            
            self.nearbyGyms = apiGyms + sortedAppleGyms
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
