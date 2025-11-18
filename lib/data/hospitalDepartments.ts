// Queensland Hospital Department Mappings
// Each hospital has its own set of available departments with organisational unit numbers

export interface Hospital {
  id: string;
  name: string;
  departments: string[];
}

export interface DepartmentOrgUnit {
  department: string;
  orgUnitNo: string;
}

export interface DepartmentDelegate {
  department: string;
  delegateName: string;
  delegatePosition: string;
  delegatePhone: string;
  delegateEmail: string;
}

export interface HospitalDepartmentMapping {
  hospitalId: string;
  hospitalName: string;
  departmentOrgUnits: DepartmentOrgUnit[];
  departmentDelegates: DepartmentDelegate[];
}

export const QUEENSLAND_HOSPITALS: Hospital[] = [
  {
    id: 'tuh',
    name: 'Townsville University Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Cardiothoracic Surgery',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Neurosurgery',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Radiation Oncology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
      'Vascular Surgery',
    ]
  },
  {
    id: 'rbwh',
    name: 'Royal Brisbane and Women\'s Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Cardiothoracic Surgery',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Neurosurgery',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Radiation Oncology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
      'Vascular Surgery',
    ]
  },
  {
    id: 'princess_alexandra',
    name: 'Princess Alexandra Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Neurosurgery',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Radiation Oncology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
      'Vascular Surgery',
    ]
  },
  {
    id: 'mater_brisbane',
    name: 'Mater Hospital Brisbane',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Radiation Oncology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  },
  {
    id: 'gold_coast_university',
    name: 'Gold Coast University Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Radiation Oncology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
      'Vascular Surgery',
    ]
  },
  {
    id: 'cairns_hospital',
    name: 'Cairns Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  },
  {
    id: 'rockhampton_hospital',
    name: 'Rockhampton Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  },
  {
    id: 'mackay_hospital',
    name: 'Mackay Base Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  },
  {
    id: 'toowoomba_hospital',
    name: 'Toowoomba Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  },
  {
    id: 'bundaberg_hospital',
    name: 'Bundaberg Hospital',
    departments: [
      'Anaesthetics',
      'Cardiology',
      'Dermatology',
      'Emergency Medicine',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'General Surgery',
      'Geriatrics',
      'Gynaecology',
      'Haematology',
      'Infectious Diseases',
      'Intensive Care Medicine',
      'Medical Oncology',
      'Nephrology',
      'Neurology',
      'Obstetrics',
      'Obstetrics & Gynaecology',
      'Ophthalmology',
      'Orthopaedic Surgery',
      'Otolaryngology (ENT)',
      'Paediatrics',
      'Palliative Care',
      'Pathology',
      'Plastic Surgery',
      'Psychiatry',
      'Radiology',
      'Rehabilitation Medicine',
      'Respiratory Medicine',
      'Rheumatology',
      'Urology',
    ]
  }
];

// Helper function to get departments for a specific hospital
export function getDepartmentsForHospital(hospitalId: string): string[] {
  const hospital = QUEENSLAND_HOSPITALS.find(h => h.id === hospitalId);
  return hospital ? hospital.departments : [];
}

// Helper function to get hospital by ID
export function getHospitalById(hospitalId: string): Hospital | undefined {
  return QUEENSLAND_HOSPITALS.find(h => h.id === hospitalId);
}

// Helper function to get all hospital names
export function getAllHospitalNames(): string[] {
  return QUEENSLAND_HOSPITALS.map(h => h.name);
}

// Organisational Unit Number Mappings
// This data needs to be populated with actual organisational unit numbers for each hospital-department combination
export const HOSPITAL_DEPARTMENT_ORG_UNITS: HospitalDepartmentMapping[] = [
  {
    hospitalId: 'tuh',
    hospitalName: 'Townsville University Hospital',
    departmentOrgUnits: [
      // Example mappings - these need to be replaced with actual organisational unit numbers
      { department: 'Neurosurgery', orgUnitNo: '12345678' },
      { department: 'Cardiology', orgUnitNo: '12345679' },
      { department: 'Emergency Medicine', orgUnitNo: '12345680' },
      { department: 'Orthopaedic Surgery', orgUnitNo: '12345681' },
      { department: 'General Surgery', orgUnitNo: '12345682' },
      { department: 'Anaesthetics', orgUnitNo: '12345683' },
      { department: 'Intensive Care Medicine', orgUnitNo: '12345684' },
      { department: 'Obstetrics & Gynaecology', orgUnitNo: '12345685' },
      { department: 'Paediatrics', orgUnitNo: '12345686' },
      { department: 'Radiology', orgUnitNo: '12345687' },
      // Add more departments as needed...
    ],
    departmentDelegates: [
      // Delegate mappings will be added here as needed
    ]
  },
  {
    hospitalId: 'rbwh',
    hospitalName: 'Royal Brisbane and Women\'s Hospital',
    departmentOrgUnits: [
      { department: 'Neurosurgery', orgUnitNo: '22345678' },
      { department: 'Cardiology', orgUnitNo: '22345679' },
      { department: 'Emergency Medicine', orgUnitNo: '22345680' },
      // Add more departments as needed...
    ],
    departmentDelegates: [
      // Delegate mappings will be added here as needed
    ]
  },
  // Add more hospitals as needed...
];

// Helper function to get organisational unit number for a specific hospital-department combination
export function getOrgUnitForDepartment(hospitalName: string, department: string): string | null {
  const hospital = HOSPITAL_DEPARTMENT_ORG_UNITS.find(h => h.hospitalName === hospitalName);
  if (!hospital) return null;
  
  const departmentMapping = hospital.departmentOrgUnits.find(d => d.department === department);
  return departmentMapping ? departmentMapping.orgUnitNo : null;
}

// Helper function to get all departments for a hospital with their organisational unit numbers
export function getDepartmentsWithOrgUnits(hospitalName: string): DepartmentOrgUnit[] {
  const hospital = HOSPITAL_DEPARTMENT_ORG_UNITS.find(h => h.hospitalName === hospitalName);
  return hospital ? hospital.departmentOrgUnits : [];
}

// Helper function to get delegate information for a specific hospital-department combination
export function getDelegateForDepartment(hospitalName: string, department: string): DepartmentDelegate | null {
  const hospital = HOSPITAL_DEPARTMENT_ORG_UNITS.find(h => h.hospitalName === hospitalName);
  if (!hospital) return null;
  
  const delegateMapping = hospital.departmentDelegates.find(d => d.department === department);
  return delegateMapping || null;
}

// Helper function to get all departments for a hospital with their delegate information
export function getDepartmentsWithDelegates(hospitalName: string): DepartmentDelegate[] {
  const hospital = HOSPITAL_DEPARTMENT_ORG_UNITS.find(h => h.hospitalName === hospitalName);
  return hospital ? hospital.departmentDelegates : [];
}
