   // CSV parsing function
   function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const csvData = event.target.result;
            const rows = csvData.split('\n');
            const headers = rows[0].split(',').map(h => h.trim());
            const data = [];
            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',').map(v => v.trim());
                if (values.length === headers.length) {
                    const row = {};
                    for (let j = 0; j < headers.length; j++) {
                        row[headers[j]] = values[j];
                    }
                    data.push(row);
                }
            }
            resolve(data);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

// Room allocation algorithm with first come, first served basis
function allocateRooms(groups, hostels) {
    const allocations = [];
    const unallocated = [];
    const boyHostels = hostels.filter(h => h['Gender'] === 'Boys');
    const girlHostels = hostels.filter(h => h['Gender'] === 'Girls');
    const roomCounts = {
        boys: { total: boyHostels.length, occupied: 0 },
        girls: { total: girlHostels.length, occupied: 0 }
    };
    const overcrowded = { boys: 0, girls: 0 };
    let totalApplied = 0;
    let totalAllocated = 0;

    // Sort groups by their index to maintain first come, first served
    groups.sort((a, b) => a.index - b.index);

    for (const group of groups) {
        const groupId = group['Group ID'];
        const members = parseInt(group['Members']);
        const gender = group['Gender'];
        totalApplied += members;

        if (gender.includes('&')) {
            // Mixed gender group
            const [boys, girls] = gender.split('&').map(g => parseInt(g.trim()));
            totalAllocated += allocateGroup(groupId, boys, 'Boys', boyHostels, allocations, unallocated, roomCounts, overcrowded);
            totalAllocated += allocateGroup(groupId, girls, 'Girls', girlHostels, allocations, unallocated, roomCounts, overcrowded);
        } else {
            // Single gender group
            const targetHostels = gender === 'Boys' ? boyHostels : girlHostels;
            totalAllocated += allocateGroup(groupId, members, gender, targetHostels, allocations, unallocated, roomCounts, overcrowded);
        }
    }

    const totalOvercrowded = totalApplied - totalAllocated;
    return { allocations, unallocated, roomCounts, overcrowded, totalApplied, totalAllocated, totalOvercrowded };
}

function allocateGroup(groupId, members, gender, hostels, allocations, unallocated, roomCounts, overcrowded) {
    let remainingMembers = members;
    let allocated = 0;

    for (const hostel of hostels) {
        if (remainingMembers === 0) break;
        
        const capacity = parseInt(hostel['Capacity']);
        if (capacity > 0) {
            const toAllocate = Math.min(remainingMembers, capacity);
            allocations.push({
                'Group ID': groupId,
                'Hostel Name': hostel['Hostel Name'],
                'Room Number': hostel['Room Number'],
                'Gender': gender,
                'Total Members': toAllocate
            });

            remainingMembers -= toAllocate;
            hostel['Capacity'] -= toAllocate;
            allocated += toAllocate;

            if (toAllocate > 0) {
                roomCounts[gender.toLowerCase()].occupied++;
            }
        }
    }

    if (remainingMembers > 0) {
        unallocated.push({
            'Group ID': groupId,
            'Gender': gender,
            'Total Members': remainingMembers
            
        });

        overcrowded[gender.toLowerCase()] += remainingMembers;
    }

    return allocated;
}

// Display results
function displayResults(allocations, unallocated, roomCounts, overcrowded, totalApplied, totalAllocated, totalOvercrowded) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h2>Allocation Results</h2>';

    // Group allocations by Room Number
    const groupedAllocations = {};
    allocations.forEach(allocation => {
        const roomKey = `${allocation['Hostel Name']}-${allocation['Room Number']}`;
        if (!groupedAllocations[roomKey]) {
            groupedAllocations[roomKey] = [];
        }
        groupedAllocations[roomKey].push(allocation);
    });

    // Display allocations grouped by room
    Object.entries(groupedAllocations).forEach(([roomKey, roomAllocations]) => {
        const roomGroup = document.createElement('div');
        roomGroup.className = 'room-group';
        const [hostelName, roomNumber] = roomKey.split('-');
        roomGroup.innerHTML = `<h3>Hostel: ${hostelName}, Room: ${roomNumber}</h3>`;

        const table = document.createElement('table');
        const headers = ['Group ID', 'Hostel Name', 'Room Number', 'Gender', 'Total Members'];
        
        const headerRow = table.insertRow();
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });

        roomAllocations.forEach(allocation => {
            const row = table.insertRow();
            headers.forEach(header => {
                const cell = row.insertCell();
                cell.textContent = allocation[header];
            });
        });

        roomGroup.appendChild(table);
        resultsDiv.appendChild(roomGroup);
    });

    // Display unallocated members
    const unallocatedDiv = document.createElement('div');
    unallocatedDiv.innerHTML = `<h3>Unallocated Members</h3>`;

    const unallocatedTable = document.createElement('table');
    const unallocatedHeaders = ['Group ID', 'Gender', 'Total Members'];
    const unallocatedHeaderRow = unallocatedTable.insertRow();
    unallocatedHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        unallocatedHeaderRow.appendChild(th);
    });

    unallocated.forEach(member => {
        const row = unallocatedTable.insertRow();
        unallocatedHeaders.forEach(header => {
            const cell = row.insertCell();
            cell.textContent = member[header];
        });
    });

    unallocatedDiv.appendChild(unallocatedTable);
    resultsDiv.appendChild(unallocatedDiv);

    // Display summary
    const summary = document.createElement('div');
    summary.innerHTML = `
        <h3>Summary</h3>
        <p>Total Applied: ${totalApplied}  Total Allocated: ${totalAllocated}</p>
        <p>Total Overcrowded: ${totalOvercrowded}</p>
        <p>Overcrowded Boys: ${overcrowded.boys}  Overcrowded Girls: ${overcrowded.girls}</p>
    `;

    resultsDiv.appendChild(summary);

    // Display download buttons
    const downloadOptions = document.getElementById('downloadOptions');
    downloadOptions.style.display = 'flex';

    const downloadAllocatedBtn = document.getElementById('downloadAllocatedBtn');
    downloadAllocatedBtn.style.display = 'block';
    downloadAllocatedBtn.addEventListener('click', () => generateCSV(allocations, 'allocated_members.csv'));

    const downloadUnallocatedBtn = document.getElementById('downloadUnallocatedBtn');
    if (totalOvercrowded > 0) {
        downloadUnallocatedBtn.style.display = 'block';
        downloadUnallocatedBtn.addEventListener('click', () => generateCSV(unallocated, 'unallocated_members.csv'));
    } else {
        downloadUnallocatedBtn.style.display = 'none';
    }
}

// CSV generation function
function generateCSV(data, filename) {
    const headers = Object.keys(data[0]);
    const csvContent = headers.join(',') + '\n' +
        data.map(row => headers.map(header => row[header]).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Form submission handling
const uploadForm = document.getElementById('uploadForm');
uploadForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const groupFile = document.getElementById('groupFile').files[0];
    const hostelFile = document.getElementById('hostelFile').files[0];

    try {
        const groups = await parseCSV(groupFile);
        const hostels = await parseCSV(hostelFile);

        if (groups.length === 0 || hostels.length === 0) {
            throw new Error('No valid data found in CSV files.');
        }

        const { allocations, unallocated, roomCounts, overcrowded, totalApplied, totalAllocated, totalOvercrowded } = allocateRooms(groups, hostels);
        displayResults(allocations, unallocated, roomCounts, overcrowded, totalApplied, totalAllocated, totalOvercrowded);
    } catch (error) {
        console.error('Error processing files:', error);
        alert('Error processing files. Please check the console for details.');
    }
});