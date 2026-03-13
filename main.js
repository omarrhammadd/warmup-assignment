const fs = require("fs");
const { text } = require("stream/consumers");

// Helper: Convert 12-hour time string to seconds since midnight
function timeToSeconds(timeStr) {
    const [time, meridiem] = timeStr.trim().toLowerCase().split(" ");
    const [h, m, s] = time.split(":").map((n) => parseInt(n, 10));
    let hour = h % 12;
    if (meridiem === "pm") hour += 12;
    return hour * 3600 + m * 60 + s;
}

// Helper: Convert duration string "h:mm:ss" to seconds
function durationToSeconds(durStr) {
    const [h, m, s] = durStr.split(":").map((n) => parseInt(n, 10));
    return h * 3600 + m * 60 + s;
}

// Helper: Convert seconds to duration string "h:mm:ss"
function secondsToDuration(totalSec) {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const paddedMinutes = String(minutes).padStart(2, "0");
    const paddedSeconds = String(seconds).padStart(2, "0");
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
}

// Time subtract helper: duration from time2 to time1
function subtractTimes(time1, time2) {
    const startSec = timeToSeconds(time2);
    const endSec = timeToSeconds(time1);
    let durationSec = endSec - startSec;
    if (durationSec < 0) {
        durationSec += 24 * 3600;
    }
    return secondsToDuration(durationSec);
}


// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {

    return subtractTimes(endTime, startTime);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const deliveryStartSec = 8 * 3600; // 8:00 AM
    const deliveryEndSec = 22 * 3600; // 10:00 PM

    let shiftStartSec = timeToSeconds(startTime);
    let shiftEndSec = timeToSeconds(endTime);

    if (shiftEndSec < shiftStartSec) {
        shiftEndSec += 24 * 3600;
    }

    let idleSec = 0;

    // Idle time before 8:00 AM
    if (shiftStartSec < deliveryStartSec) {
        const idleEnd = Math.min(shiftEndSec, deliveryStartSec);
        idleSec += idleEnd - shiftStartSec;
    }

    // Idle time after 10:00 PM
    if (shiftEndSec > deliveryEndSec) {
        const idleStart = Math.max(shiftStartSec, deliveryEndSec);
        idleSec += shiftEndSec - idleStart;
    }

    return secondsToDuration(idleSec);
}


// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftSec = durationToSeconds(shiftDuration);
    const idleSec = durationToSeconds(idleTime);
    const activeSec = Math.max(0, shiftSec - idleSec);
    return secondsToDuration(activeSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    // normal quota is 8 hours and 24 minutes
    let minQuotaSec = 8 * 3600 + 24 * 60; // 8 hours and 24 minutes in seconds
    const activeSec = durationToSeconds(activeTime);
    // check if date is in Eid Period (April 10 to April 30, 2025)
    const eidStart = "2025-04-10";
    const eidEnd = "2025-04-30";
    
    if (date >= eidStart && date <= eidEnd) {
        minQuotaSec = 6 * 3600; // 6 hours in seconds during Eid Period
    }
    return activeSec >= minQuotaSec;

}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let text = fs.readFileSync(textFile, "utf-8");
    let lines = text.trim().split("\n");
    let fields = lines.map((line) => line.split(","));
    for (let i = 0; i < lines.length; i++) {
        if (fields[i][0] === shiftObj.driverID && 
            fields[i][2] === shiftObj.date && 
            fields[i][3] === shiftObj.startTime && 
            fields[i][4] === shiftObj.endTime) {
            return {};
        }
    }
    // calculate ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus
    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const metQuotaResult = metQuota(shiftObj.date, activeTime);
    const hasBonus = false; // default to false
    // create new record string
    const newRecord = `${shiftObj.driverID},${shiftObj.driverName},${shiftObj.date},${shiftObj.startTime},${shiftObj.endTime},${shiftDuration},${idleTime},${activeTime},${metQuotaResult},${hasBonus}`;
    // append new record to text file
    fs.appendFileSync(textFile, `\n${newRecord}`);
    // return new record as object
    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQuotaResult,
        hasBonus: hasBonus
    };


    
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let text = fs.readFileSync(textFile, "utf-8");
    let lines = text.trim().split("\n");
    let fields = lines.map((line) => line.split(","));
    for (let i = 0; i < lines.length; i++) {
        if (fields[i][0] === driverID && fields[i][2] === date) {
            fields[i][9] = newValue; // update HasBonus field
            break;
        }    }
    // convert fields back to lines
    let newLines = fields.map((field) => field.join(","));
    // write updated lines back to text file
    fs.writeFileSync(textFile, newLines.join("\n"), "utf-8");
    return;
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const text = fs.readFileSync(textFile, "utf-8");
    const lines = text.trim().split("\n");
    const targetMonth = parseInt(month, 10);

    let bonusCount = 0;
    let driverFound = false;

    for (const line of lines) {
        if (!line.trim()) continue;

        const cols = line.split(",").map((c) => c.trim());
        if (cols[0] === "DriverID") continue; // header

        if (cols[0] === driverID) {
            driverFound = true;
            const recordMonth = parseInt(cols[2].split("-")[1], 10);
            if (recordMonth === targetMonth && cols[9].toLowerCase() === "true") {
                bonusCount++;
            }
        }
    }

    return driverFound ? bonusCount : -1;

}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const text = fs.readFileSync(textFile, "utf-8");
    const lines = text.trim().split("\n");
    const targetMonth = parseInt(month, 10);

    let totalSec = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        const cols = line.split(",").map((c) => c.trim());
        if (cols[0] === "DriverID") continue; // header
        if (cols[0] !== driverID) continue;

        const recordMonth = parseInt(cols[2].split("-")[1], 10);
        if (recordMonth !== targetMonth) continue;

        totalSec += durationToSeconds(cols[7]);
    }

    return secondsToDuration(totalSec);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    const text = fs.readFileSync(textFile, "utf-8");
    const lines = text.trim().split("\n");
    const targetMonth = parseInt(month, 10);

    // Define quota rules
    const normalQuotaSec = 8 * 3600 + 24 * 60; // 8:24
    const eidQuotaSec = 6 * 3600; // 6:00
    const eidStart = "2025-04-10";
    const eidEnd = "2025-04-30";

    let requiredSec = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        const cols = line.split(",").map((c) => c.trim());
        if (cols[0] === "DriverID") continue; // header
        if (cols[0] !== driverID) continue;

        const parts = cols[2].split("-");
        const recordMonth = parseInt(parts[1], 10);
        if (recordMonth !== targetMonth) continue;

        const date = cols[2];
        const quotaSec = date >= eidStart && date <= eidEnd ? eidQuotaSec : normalQuotaSec;
        requiredSec += quotaSec;
    }

    // Reduce required hours by bonus count (each bonus reduces required time by 2 hours)
    const bonusReductionSec = bonusCount * 2 * 3600;
    requiredSec = Math.max(0, requiredSec - bonusReductionSec);

    return secondsToDuration(requiredSec);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    const text = fs.readFileSync(rateFile, "utf-8");
    const lines = text.trim().split("\n");

    // Find driver record in rate file
    let basePay = 0;
    let tier = 0;
    for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split(",").map((c) => c.trim());
        if (cols[0] === driverID) {
            basePay = parseInt(cols[2], 10);
            tier = parseInt(cols[3], 10);
            break;
        }
    }

    const actualSec = durationToSeconds(actualHours);
    const requiredSec = durationToSeconds(requiredHours);
    const missingSec = Math.max(0, requiredSec - actualSec);

    // Tier allowances (hours)
    const tierAllowance = {
        1: 50,
        2: 20,
        3: 10,
        4: 3,
    };

    const allowedSec = (tierAllowance[tier] ?? 0) * 3600;
    const extraSec = Math.max(0, missingSec - allowedSec);

    // Only deduct on whole missing hours beyond allowance
    const extraHours = Math.floor(extraSec / 3600);

    const deductionRatePerHour = Math.floor(basePay / 185);
    const deduction = extraHours * deductionRatePerHour;
    const netPay = basePay - deduction;

    return netPay;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
