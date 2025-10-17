'use strict';

(function() {
    const statusEl = document.getElementById('overviewStatus');
    const totalEl = document.getElementById('totalCasesValue');
    const dailyEl = document.getElementById('dailyCasesValue');
    const weeklyEl = document.getElementById('weeklyCasesValue');

    const emergencyBody = document.getElementById('emergencyTableBody');
    const reportsBody = document.getElementById('reportsTableBody');
    const referralBody = document.getElementById('referralTableBody');
    const teamBody = document.getElementById('teamTableBody');

    if (!statusEl) return; // Not on the overview tab

    function setStatus(msg, type) {
        statusEl.className = 'alert py-2 px-3 mb-3';
        statusEl.classList.add(type === 'error' ? 'alert-danger' : (type === 'ok' ? 'alert-success' : 'alert-info'));
        statusEl.textContent = msg;
        statusEl.style.display = '';
    }

    function hideStatus() {
        statusEl.style.display = 'none';
    }

    function formatTs(ts) {
        if (!ts) return '';
        try {
            if (ts.toDate) return ts.toDate().toISOString();
            if (typeof ts === 'string') return ts;
            if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
        } catch(e) {}
        return String(ts);
    }

    function renderRows(bodyEl, rows, columns) {
        if (!bodyEl) return;
        bodyEl.innerHTML = '';
        const frag = document.createDocumentFragment();
        rows.forEach(r => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = r[col] ?? '';
                tr.appendChild(td);
            });
            frag.appendChild(tr);
        });
        if (rows.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = columns.length;
            td.className = 'text-center';
            td.textContent = 'No data found.';
            tr.appendChild(td);
            frag.appendChild(tr);
        }
        bodyEl.appendChild(frag);
    }

    function computeDailyWeekly(docs) {
        try {
            const now = new Date();
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const weekStart = new Date(today);
            weekStart.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7)); // Monday

            let daily = 0, weekly = 0;
            docs.forEach(d => {
                const ts = d.timestamp;
                let date;
                if (ts && ts.toDate) date = ts.toDate();
                else if (typeof ts === 'string') date = new Date(ts);
                else if (ts && ts.seconds) date = new Date(ts.seconds * 1000);
                if (!date) return;
                const dUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
                if (dUTC.getTime() === today.getTime()) daily++;
                if (dUTC >= weekStart && dUTC <= today) weekly++;
            });
            if (dailyEl) dailyEl.textContent = String(daily);
            if (weeklyEl) weeklyEl.textContent = String(weekly);
        } catch (e) {
            console.error('KPI compute error', e);
        }
    }

    try {
        setStatus('Connecting to realtime updates...', 'info');

        // Initialize Firebase app and Firestore (expects firebase-app-compat and firebase-firestore-compat loaded)
        if (!firebase || !firebase.firestore) {
            setStatus('Realtime unavailable: Firebase SDK not loaded', 'error');
            return;
        }
        const db = firebase.firestore();

        // Listener 1: Recent 5 emergency records for the table
        const unsubEmergencyTable = db.collection('emergency_form')
            .orderBy('timestamp', 'desc').limit(5)
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderRows(emergencyBody, docs.map(d => ({
                    patient_name: d.patient_name || '',
                    age: d.age || '',
                    chief_complaint: d.chief_complaint || '',
                    date_of_incident: d.date_of_incident || '',
                    date_of_birth: d.date_of_birth || '',
                })), ['patient_name', 'age', 'chief_complaint', 'date_of_incident', 'date_of_birth']);
                hideStatus();
            }, err => {
                console.error(err);
                setStatus('Realtime error on emergency data. Retrying...', 'error');
            });

        // Listener 2: Total count across the whole emergency_form collection
        const unsubEmergencyTotal = db.collection('emergency_form')
            .onSnapshot(snap => {
                if (totalEl) totalEl.textContent = String(snap.size);
            }, err => {
                console.error(err);
            });

        // Listener 3: Bounded window for daily/weekly KPIs (past 7 days)
        const now = new Date();
        const weekStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        weekStartUTC.setUTCDate(weekStartUTC.getUTCDate() - 6); // last 7 days including today
        const unsubEmergencyKPI = db.collection('emergency_form')
            .where('timestamp', '>=', weekStartUTC)
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                computeDailyWeekly(docs);
            }, err => {
                console.error(err);
            });

        // Resident reports
        const unsubReports = db.collection('resident_reports')
            .orderBy('timestamp', 'desc').limit(5)
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderRows(reportsBody, docs.map(d => ({
                    fullname: d.fullname || '',
                    description: d.description || '',
                    location: d.location || '',
                    timestamp: formatTs(d.timestamp),
                })), ['fullname', 'description', 'location', 'timestamp']);
                hideStatus();
            }, err => {
                console.error(err);
                setStatus('Realtime error on resident reports. Retrying...', 'error');
            });

        // Referrals
        const unsubReferral = db.collection('referral')
            .orderBy('timestamp', 'desc').limit(5)
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderRows(referralBody, docs.map(d => ({
                    patient_name: d.patient_name || '',
                    reason_for_referral: d.reason_for_referral || '',
                    receiving_institution: d.receiving_institution || '',
                    timestamp: formatTs(d.timestamp),
                })), ['patient_name', 'reason_for_referral', 'receiving_institution', 'timestamp']);
                hideStatus();
            }, err => {
                console.error(err);
                setStatus('Realtime error on referrals. Retrying...', 'error');
            });

        // Responding team
        const unsubTeam = db.collection('responding_team')
            .orderBy('timestamp', 'desc').limit(5)
            .onSnapshot(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderRows(teamBody, docs.map(d => ({
                    team_leader: d.team_leader || '',
                    team_member: d.team_member || '',
                    team_operator: d.team_operator || '',
                    timestamp: formatTs(d.timestamp),
                })), ['team_leader', 'team_member', 'team_operator', 'timestamp']);
                hideStatus();
            }, err => {
                console.error(err);
                setStatus('Realtime error on responding team. Retrying...', 'error');
            });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            try { unsubEmergencyTable && unsubEmergencyTable(); } catch(e) {}
            try { unsubEmergencyTotal && unsubEmergencyTotal(); } catch(e) {}
            try { unsubEmergencyKPI && unsubEmergencyKPI(); } catch(e) {}
            try { unsubReports && unsubReports(); } catch(e) {}
            try { unsubReferral && unsubReferral(); } catch(e) {}
            try { unsubTeam && unsubTeam(); } catch(e) {}
        });

    } catch (e) {
        console.error(e);
        setStatus('Realtime initialization failed.', 'error');
    }
})(); 