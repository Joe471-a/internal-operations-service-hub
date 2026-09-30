# Internal Operations Service Hub - Data Model

## Domain

### Important entities
#### Employee
Represents a person using the service hub including the department staff/team who can use this hub to handle and send request.

example: An IT staff member can handle an IT request from another employee and can also submit a request to another department, such as HR, when they need something from that department.

So in short a department staff is an employee but not every employee is department staff.

#### Department
Represents the department of the company who receive the requests 

#### Department staff
Represents the organizational team (Department staff) responsible for handling requests.

- Employee + role = Department staff 
- (Employee + role)+ extra visibility = Department lead
- Department staff + extra visibility = Department lead

#### Request
Represents a request submitted through the service hub.

### Relationships + cardinality
![Relations and cardinality](../images/relationsAndcardinality.png)
- 1- One Employee can submit many Requests.Each Request is submitted by one Employee.
- 2- One Department can handle many Requests.Each Request is handled by one Department.
- 3- One Department can have many Department Staff members.Each Department Staff member belongs to one Department.

Department staff ≠ Department 
Department staff are employees who belong to a department and are authorized to handle requests for that department.
### Ownership
- Each request is created by one employee.
- Each request is assigned to one department for handling.
- Staff members handle requests as part of their department.

## Lifecycle + Rules 

### State transition
![Lifecycle](../images/lifecycle.png)
Assigned: The request has been routed to the department responsible for handling it. This does not mean that the request is assigned to a specific department staff member.


### What each status means

| Status | Meaning | Set by |
|---|---|---|
| Submitted | Received by the system, not yet reviewed | Employee (on submit) |
| Assigned | Department accepted it into its work queue, not started | Department lead |
| In Progress | A staff member is actively working on it | Department staff |
| Completed | Work finished | Department staff |
| Denied | Department rejected it (only from Submitted) | Department lead |


### Invariants 
- Every request must have a valid status.
- A request cannot have an invalid or undefined state.
- A completed request cannot move back to an earlier state.
- Only valid state transitions are allowed.

### Authorization + Sensitive Rules
- Users can only perform actions they are authorized to perform.
- Users must not be able to view requests or departmental information they are not authorized to access.



## Storage

### Relational/document reasoning 
A relational database is preferred because the system has clear relationships between employees, requests, and departments. These relationships are important when retrieving and managing request information, making joins an important part of the system.

Although a document database provides more flexibility in how data is structured, this flexibility is not a major requirement for the current system. The need for structured relationships and consistent data is more important than schema flexibility.

Therefore, relational storage is preferred over document storage.
### What is durable vs derived
#### Durable data 
The system needs to permanently store:
- Employee information
- Department information
- Requests
- Request status
- Request creation and update information

This data must remain available after the request is submitted and after temporary system failures.
#### Derived data 
The system can calculate information from the stored data when needed, such as:
- Number of requests submitted by an employee
- Number of requests handled by a department
- Number of completed or pending requests


## Access 
### Important queries / access patterns 
Important queries:
- View an employee's requests 
- View pending requests for a department	
- View the current status of a request	
- View a specific request
- View request history

Access patterns
- employee_id --> requests  
Used for the employee's "my requests" list.

- department_id + status --> requests
Used for a department's work queue (e.g. all Submitted IT requests). 

- status --> requests
Used for a system-wide / admin view (e.g. everything In Progress).

- request_id --> request
 Used when opening one request's detail page.

- request_id --> request history
Used to show a request's full timeline.

### Indexes only when justified 
- An index will be on department_id (IT, Finance, HR) can improve the retrieval of requests for a specific department especially as the number of requests grows. the database can use the index to go directly toward the relevant records instead of checking the entire table.

## As built (v1.0)

The design above is the conceptual model. This is how it was implemented
(`backend/prisma/schema.prisma`, PostgreSQL - see ADR-004).

| Designed (above) | Built |
|---|---|
| Employee, Department staff and Department lead | **One `User` table** with a `role` column (`employee`, `staff` or `lead`) and an optional `department`. Staff and lead are an employee plus a role and a department, exactly the "Employee + role" idea above; an employee has no department. The permissions for each role live in code (`actors.ts`), not in the database. |
| Department | **An enum** (`IT`, `HR`, `FINANCE`) instead of a table - departments never change while the system runs, so a table would add joins without adding anything. |
| Request | **`ServiceRequest`**: title, description, department, current status, who submitted it, last update, and `aiVerified` (whether the AI check actually ran). Its id is a number assigned by the database in order and shown as `REQ-1006`, so two requests can never share one. |
| Request history | **`RequestEvent`**: one row per status change - which status, when, and who made it. |
| Users and passwords | `User` also holds a unique `username` and a bcrypt `passwordHash` - never the plain password. |

**Indexes, as justified by the access patterns:**

| Access pattern | Index |
|---|---|
| department + status → requests (the department queues) | `ServiceRequest(department, currentStatus)` |
| employee → requests ("My Requests") | `ServiceRequest(submittedBy)` |
| request → history | `RequestEvent(requestId)` |
| username → user (sign-in) | unique `User(username)` |


