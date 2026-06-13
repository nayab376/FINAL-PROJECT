# Doctor Hub

Doctor Hub is a healthcare consultation and patient history management platform built as a final semester project.
It supports doctor search, appointment booking, medical history management, prescriptions, payment verification, and role-based access control.

#Screenshot
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/6785040e-b4a2-4c90-9914-0db506b997ff" />

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/dcbef7c8-deb7-4968-8e43-d24f3feb3128" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/c4a56e71-5fd9-49e8-9ce4-5ace895857f1" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/d194b723-450f-4b7c-bb4a-f355ba867ad6" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/5fe11d90-e060-43e3-82c9-4c469e206cf1" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/ce6eb086-82c1-4d02-bd35-d4e56591e5f4" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/86afddfb-17ae-47ed-b640-3b514aab8d6a" />
<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/5e39fae1-1f46-4f39-8cee-f8feef2d3567" />


<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/b66bfdf6-7421-4d0b-96bf-a1f87f92da82" />

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/19b0be6b-e282-4eed-ba4a-dd23b3d943bf" />


## Features

- Doctor search and filtering by specialty and treatment type
- Appointment booking and payment verification workflow
- Medical history sharing with immutable record rules
- Prescription management by doctors
- Role-based access: patient, doctor, assistant, admin, super-admin
- JWT authentication with secure password hashing
- Protected medical records and secure REST APIs

## Running the project

1. Install dependencies:

   npm install
   
2. Start the server:

   npm start

3. Open a browser and visit `http://localhost:3000`

## APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/doctors`
- `POST /api/appointments`
- `POST /api/payments`
- `GET /api/history`

## Notes

- The application uses an SQLite database created automatically on first run.
- Registration requires an uppercase letter, lowercase letter, digit, and special character.
- Dashboard and appointment views are available after login.
- Doctor search includes doctor name, details, availability, and specialty.
