#!/usr/bin/env python3
"""
Script to seed PDF template coordinate mappings in production Supabase
Usage: python3 scripts/seed_production_templates.py <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY>
"""

import sys
import json
import requests
from pathlib import Path

def load_coordinate_mapping(file_path):
    """Load coordinate mapping from JSON file"""
    with open(file_path, 'r') as f:
        return json.load(f)

def seed_template(supabase_url, service_role_key, template_type, version, storage_path, coordinates):
    """Insert or update a template in the database"""
    url = f"{supabase_url}/rest/v1/pdf_templates"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    payload = {
        "template_type": template_type,
        "version": version,
        "pdf_storage_path": storage_path,
        "coordinate_mapping": coordinates,
        "is_active": True
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code in [200, 201]:
        print(f"✓ {template_type} v{version} seeded successfully")
        return True
    else:
        print(f"✗ Failed to seed {template_type}: {response.status_code} {response.text}")
        return False

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/seed_production_templates.py <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY>")
        sys.exit(1)
    
    supabase_url = sys.argv[1]
    service_role_key = sys.argv[2]
    
    # Load coordinate mappings
    base_dir = Path(__file__).parent.parent
    normal_coords_path = base_dir / "supabase/sql/avac_normal_coords.json"
    smo_coords_path = base_dir / "supabase/sql/avac_smo_coords.json"
    
    if not normal_coords_path.exists():
        print(f"Error: Coordinate file not found: {normal_coords_path}")
        sys.exit(1)
    
    if not smo_coords_path.exists():
        print(f"Error: Coordinate file not found: {smo_coords_path}")
        sys.exit(1)
    
    print("Loading coordinate mappings...")
    normal_coords = load_coordinate_mapping(normal_coords_path)
    smo_coords = load_coordinate_mapping(smo_coords_path)
    
    print(f"Seeding templates to {supabase_url}...")
    
    # Seed normal AVAC
    success1 = seed_template(
        supabase_url,
        service_role_key,
        "avac_normal",
        "v1",
        "pdf-templates/avac_normal/v1.pdf",
        normal_coords
    )
    
    # Seed SMO AVAC
    success2 = seed_template(
        supabase_url,
        service_role_key,
        "avac_smo",
        "v1",
        "pdf-templates/avac_smo/v1.pdf",
        smo_coords
    )
    
    if success1 and success2:
        print("\n✓ All templates seeded successfully!")
        sys.exit(0)
    else:
        print("\n✗ Some templates failed to seed")
        sys.exit(1)

if __name__ == "__main__":
    main()
