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
    
    func searchNearbyGyms() {
        guard let location = userLocation else { 
            requestPermission()
            return 
        }
        
        isSearching = true
        
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "gym"
        request.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 5000, longitudinalMeters: 5000)
        
        let search = MKLocalSearch(request: request)
        search.start { [weak self] response, error in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.isSearching = false
                
                if let mapItems = response?.mapItems {
                    self.nearbyGyms = mapItems.map { item in
                        // Use non-deprecated property (iOS 18+)
                        let gymLocation = item.location
                        let distance = location.distance(from: gymLocation)
                        
                        return NearbyGym(
                            name: item.name ?? "Okänt gym",
                            address: item.name, // Using name as a safe alternative to deprecated placemark.title if better property is not found
                            latitude: gymLocation.coordinate.latitude,
                            longitude: gymLocation.coordinate.longitude,
                            distance: distance
                        )
                    }.sorted(by: { $0.distance < $1.distance })
                }
            }
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
