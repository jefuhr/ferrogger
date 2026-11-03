// Route colors and landing order come from the NYC Ferry GTFS feed. Each level
// is themed on one route, and its five slips are real landings on that route.
export const ROUTES = [
	{
		id: "ER",
		name: "East River",
		color: "#00839C",
		text: "#ffffff",
		landings: [
			{ name: "Wall St / Pier 11", short: "PIER 11" },
			{ name: "DUMBO / Fulton Ferry", short: "DUMBO" },
			{ name: "South Williamsburg", short: "S WBURG" },
			{ name: "Greenpoint", short: "GRNPT" },
			{ name: "East 34th Street", short: "E 34" },
		],
	},
	{
		id: "SB",
		name: "South Brooklyn",
		color: "#FFD100",
		text: "#001d41",
		landings: [
			{ name: "Corlears Hook", short: "CORLRS" },
			{ name: "Wall St / Pier 11", short: "PIER 11" },
			{ name: "Atlantic Ave / Pier 6", short: "PIER 6" },
			{ name: "Red Hook / Atlantic Basin", short: "RED HK" },
			{ name: "Bay Ridge", short: "BAY RDG" },
		],
	},
	{
		id: "AS",
		name: "Astoria",
		color: "#FF6B00",
		text: "#ffffff",
		landings: [
			{ name: "Brooklyn Navy Yard", short: "NAVY YD" },
			{ name: "East 34th Street", short: "E 34" },
			{ name: "Long Island City", short: "LIC" },
			{ name: "Roosevelt Island", short: "RI" },
			{ name: "Astoria", short: "ASTORIA" },
		],
	},
	{
		id: "SG",
		name: "St. George",
		color: "#D0006F",
		text: "#ffffff",
		landings: [
			{ name: "Midtown West / Pier 79", short: "PIER 79" },
			{ name: "Battery Park City", short: "BPC" },
			{ name: "St. George", short: "ST GEO" },
			{ name: "Bay Ridge", short: "BAY RDG" },
			{ name: "Atlantic Ave / Pier 6", short: "PIER 6" },
		],
	},
	{
		id: "RS",
		name: "Rockaway-Soundview",
		color: "#4E008E",
		text: "#ffffff",
		landings: [
			{ name: "Rockaway", short: "RCKWY" },
			{ name: "Sunset Park / BAT", short: "SUNSET" },
			{ name: "Stuyvesant Cove", short: "STUY CV" },
			{ name: "East 90th St", short: "E 90" },
			{ name: "Soundview", short: "SNDVW" },
		],
	},
];

export const VESSELS = [
	"Waves of Wonder", "Sunset Crossing", "Happy Hauler", "Great Eagle", "Owl’s Head",
	"Munsee", "Lunchbox", "Urban Journey", "Friendship Express", "Connector",
	"Opportunity", "Flyer", "McShiny", "Starlight", "Spring Mallard",
	"Atlantic Compass", "Ferry Godmother", "Ocean Queen Rockstar", "Seas the Day",
	"Golden Narrows", "Rainbow Cruise", "Unity", "Traversity", "Jewel of the Harbor",
	"Koalafied Cruiser", "Dream Boat", "Forget Me Knot", "Signs to Liberty",
	"River Sprinter", "Bay Hopper", "Cyclone Shark", "White Sands", "Tooth Ferry",
	"Time Traveler", "Melting Pot", "Purpose", "Curiosity", "City Fishy",
];

export function routeForLevel(level) {
	return ROUTES[(level - 1) % ROUTES.length];
}
