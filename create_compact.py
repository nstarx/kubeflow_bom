import json

# Read the SBOM file
with open('sbom.spdx.json', 'r') as f:
    data = json.load(f)

# Get full counts
all_files = data.get('files', [])
all_relationships = data.get('relationships', [])

# Calculate statistics
license_stats = {}
type_stats = {}
for file in all_files:
    license = file.get('licenseConcluded', 'Unknown')
    license_stats[license] = license_stats.get(license, 0) + 1
    
    if file.get('fileTypes'):
        for ft in file['fileTypes']:
            type_stats[ft] = type_stats.get(ft, 0) + 1

# Get sample files (first 50)
sample_files = []
for file in all_files[:50]:
    sample_files.append({
        'fileName': file.get('fileName'),
        'licenseConcluded': file.get('licenseConcluded'),
        'fileTypes': file.get('fileTypes'),
        'sha256': next((c['checksumValue'][:16] + '...' for c in file.get('checksums', []) if c['algorithm'] == 'SHA256'), '-')
    })

# Get sample relationships (first 50)
sample_relationships = []
for rel in all_relationships[:50]:
    sample_relationships.append({
        'source': rel.get('spdxElementId'),
        'type': rel.get('relationshipType'),
        'target': rel.get('relatedSpdxElement')
    })

# Create the data object
sbom_data = {
    'metadata': {
        'name': data.get('name'),
        'spdxVersion': data.get('spdxVersion'),
        'SPDXID': data.get('SPDXID'),
        'documentNamespace': data.get('documentNamespace'),
        'dataLicense': data.get('dataLicense'),
        'creationInfo': data.get('creationInfo')
    },
    'statistics': {
        'totalFiles': len(all_files),
        'totalPackages': len(data.get('packages', [])),
        'totalRelationships': len(all_relationships),
        'licenseStats': license_stats,
        'typeStats': type_stats
    },
    'sampleFiles': sample_files,
    'sampleRelationships': sample_relationships,
    'packages': data.get('packages', [])
}

# Create the JavaScript variable string
js_data = 'const EMBEDDED_SBOM_DATA = ' + json.dumps(sbom_data, indent=2) + ';'

with open('sbom_data.js', 'w') as f:
    f.write(js_data)
    
print(f"Created embedded data with:")
print(f"- {len(sample_files)} sample files (out of {len(all_files)})")
print(f"- {len(sample_relationships)} sample relationships (out of {len(all_relationships)})")
print(f"- Full statistics for all {len(all_files)} files")
print(f"- Data size: {len(js_data)} bytes")