
# Internal Operations Service Hub
A company-internal system for requesting and tracking help from departments such as IT, HR and Finance

## Problem / Context
### Context 
- Employees ask for help through messy channels 
- There is no organization
- The work is harder to coordinate and track.
### Problem 
- Employees can not easily track internal request 
- Request gets forgotten
- Sent to the wrong person 
- Ownership unclear 
- Status unclear 
- Approval unclear

## Known facts (confirmed information)
- The company needs one centralized system for all requests
- The company wants the system to be able to submit the requests
- The company wants the system to be able to handle the requests 
- The company wants the system to be able to follow these requests 
- The system should be for internal use of the company by specific departments such as(IT,HR and Finance)

## Actors / Stakeholder
### Actor
- Employees 
- IT Staff
- HR Staff
- Finance Staff
- Department Lead
### Stakeholder
- Department Lead 
- Organization

## Functional Requirements
- Employees can submit requests for help to the approriate department 
- Employees can see the status of their submitted requests regardless of the department handling them.
- Department staff can handle request assigned to their department.
- Department staff can see the current and previous request related to their department.
- Requests must always display a visible status (e.g., Submitted,Assigned, In Progress, Completed, Denied).

## Non-Functional Requirements
### Security
- The system should require authentication before users can access it.
- The system should enforce authorization based on the user's role.

### Privacy
- Users should only be able to view information they are authorized to access.

### Latency
- The system should display pages and request details within an acceptable response time.

### Availability
- The system should be available when employees need to use it.
- Temporary maintenance should minimize disruption to users.

### Freshness
- Request status changes should eventually be visible to authorized users.

### Graceful Degradation
- If a non-critical feature becomes unavailable, users should still be able to access and manage requests.
- A failure in one department's workflow should not make the entire system unavailable.

### Capacity / Throughput
- The system should support the expected number of users and requests without failing.

### Reliability / Data Integrity
- Submitted request data should not be lost if a system error occurs.
- Successfully saved changes should remain available after a temporary failure.

## Assumptions / Constraints / Unknowns 
### Assumption
- Each lead of the department can use the system and monitor the request of his department 
- Each employee has a unique account 
- Empoyee need to authenticate before accessing the system.
- An employee can send multiple request
- Request are categorized by department 
- Different employee roles have different permissions.
- A request may be denied 
- Each request has one current status.

### Constraint 
- The system is intended for internal company use.
- Access must respect employee roles and permissions.
- Sensitive departmental information must not be visible to unauthorized employees.
  

### Unknowns
- Does the employee select the department when submitting a request, or should the system determine the department?
- Can department staff view all requests related to their department, or only requests assigned specifically to them?
- Can multiple employees work on the same request?
- Can a request be reassigned or transferred between departments?
- Can employees see who is responsible for handling their request?
- Can employees edit a request after submitting it? If yes, can they still edit it after a department starts handling it?
- Do all requests have a priority level? If yes, who assigns the priority level?
- Do all requests require approval? or only some request types, or none?
- How quickly must request status changes become visible to users?
- Should requests remain available permanently, or should they be archived or automatically removed after a certain period?
- How many employees will use the system?
- How many requests are expected per day?
- What response-time target is required?
- What availability level is required?

## Non-Goals
- Replace specialized HR systems
- Replace accounting or finance software
- Replace IT monitoring systems
- Real time chat between employee and department 
- Instant response from any request 

## Acceptance criteria
### Correct Behavior
- When an employee submits a valid request, the request is created successfully.
- The submitted request appears in the employee's request list.
- The request is sent to the appropriate department.
- Existing requests remain available after a temporary system error.


#### Example Scenario: IT Request

Employee submits request : "My laptop is not turning on."  
Assigned to : IT Department  
Status updated : In Progress  
Laptop fixed : Status changed to Completed  
Employee :Sees the updated status in their request list



### Incorrect Behavior
- If required request information is missing, the request should not be submitted.
- If a user is not authenticated, they should not be able to access the system.
- If a user tries to access a request, they are not authorized to view, access should be denied.
- If request submission fails, the system should not show the request as successfully submitted.



