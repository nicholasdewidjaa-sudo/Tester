import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// KONFIGURASI FIREBASE ANDA
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyClAb67oUox356bS73dryCxlpoTSUwIZE0",
  authDomain: "project-1-3ad32.firebaseapp.com",
  projectId: "project-1-3ad32",
  storageBucket: "project-1-3ad32.firebasestorage.app",
  messagingSenderId: "1000149111658",
  appId: "1:1000149111658:web:0bba2ebdc0dd0b93064b13",
  measurementId: "G-VX6MMFZTQX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;
let editingAbsenId = null;

const todayStr = new Date().toISOString().split('T')[0];
const inputTanggalEl = document.getElementById('inputTanggal');
inputTanggalEl.value = todayStr;

// 1. SISTEM LOGIN
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMessage.innerText = "";
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
    } catch (error) {
        loginMessage.innerText = "Login gagal! Periksa email dan password.";
    }
});

// 2. MONITOR STATE & OTORISASI ROLE
onAuthStateChanged(auth, async (user) => {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');

    if (user) {
        // Blokir akun anonim jika tidak terdaftar di database users
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists() && user.email !== "admin@gmail.com") {
            alert("Akses ditolak! Akun tidak terdaftar di database sistem.");
            signOut(auth);
            return;
        }

        loginSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        document.getElementById('userEmailDisplay').innerText = user.email;

        if (user.email === "admin@gmail.com") {
            currentUserData = { role: "admin", nama: "Administrator", kelas: "-" };
        } else {
            currentUserData = userSnap.data();
        }

        setupDashboardByRole(user.uid, currentUserData);
    } else {
        currentUserData = null;
        appSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    }
});

// 3. LOGOUT
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});

// PENGATURAN DASHBOARD BERDASARKAN ROLE
function setupDashboardByRole(uid, data) {
    const role = data.role;
    
    document.getElementById('roleBadgeDisplay').innerText = role.toUpperCase();
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('thAksi').classList.add('hidden');
    document.getElementById('groupPilihSiswa').classList.add('hidden');
    inputTanggalEl.readOnly = false;

    if (role === "admin") {
        document.getElementById('roleTitleLabel').innerText = "Administrator Utama";
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('thAksi').classList.remove('hidden');
        document.getElementById('formCardTitle').innerText = "Input Absensi (Oleh Admin)";
        loadDaftarSiswaDropdown();
        loadAbsensiData("admin", uid);

    } else if (role === "guru") {
        document.getElementById('roleTitleLabel').innerText = "Guru Pengajar";
        document.getElementById('thAksi').classList.remove('hidden');
        document.getElementById('groupPilihSiswa').classList.remove('hidden');
        document.getElementById('formCardTitle').innerText = "Form Absensi Siswa";
        loadDaftarSiswaDropdown();
        loadAbsensiData("guru", uid);

    } else if (role === "siswa") {
        document.getElementById('roleTitleLabel').innerText = "Siswa";
        document.getElementById('formCardTitle').innerText = "Absensi Harian Saya";
        
        document.getElementById('inputNama').value = data.nama || "";
        document.getElementById('inputKelas').value = data.kelas || "";
        inputTanggalEl.value = todayStr;
        inputTanggalEl.readOnly = true; // Tanggal terkunci untuk siswa

        loadAbsensiData("siswa", uid);
    }
}

// 4. ADMIN: TAMBAH AKUN
const createAccountForm = document.getElementById('createAccountForm');
const adminMsg = document.getElementById('adminMsg');

createAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminMsg.innerText = "";

    const newEmail = document.getElementById('newEmail').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const newNama = document.getElementById('newNama').value.trim();
    const newKelas = document.getElementById('newKelas').value.trim();
    const newRole = document.getElementById('newRole').value;

    try {
        const tempApp = initializeApp(firebaseConfig, "SecondaryApp");
        const tempAuth = getAuth(tempApp);
        const userCred = await createUserWithEmailAndPassword(tempAuth, newEmail, newPassword);
        const newUid = userCred.user.uid;
        await signOut(tempAuth);

        await setDoc(doc(db, "users", newUid), {
            email: newEmail,
            nama: newNama,
            kelas: newKelas,
            role: newRole,
            createdAt: serverTimestamp()
        });

        adminMsg.className = "message success-msg";
        adminMsg.innerText = `Berhasil mendaftarkan akun ${newEmail} sebagai ${newRole}!`;
        createAccountForm.reset();
        loadDaftarSiswaDropdown();
    } catch (error) {
        adminMsg.className = "message error-msg";
        adminMsg.innerText = "Gagal membuat akun: " + error.message;
    }
});

// LOAD DROPDOWN SISWA
async function loadDaftarSiswaDropdown() {
    const selectSiswa = document.getElementById('selectSiswa');
    selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';

    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach(docSnap => {
        const uData = docSnap.data();
        if (uData.role === "siswa") {
            const opt = document.createElement('option');
            opt.value = uData.nama;
            opt.dataset.kelas = uData.kelas || "";
            opt.dataset.uid = docSnap.id;
            opt.text = `${uData.nama} (${uData.kelas || 'Tanpa Kelas'})`;
            selectSiswa.appendChild(opt);
        }
    });
}

document.getElementById('selectSiswa').addEventListener('change', (e) => {
    const selectedOpt = e.target.selectedOptions[0];
    if (selectedOpt && selectedOpt.value) {
        document.getElementById('inputNama').value = selectedOpt.value;
        document.getElementById('inputKelas').value = selectedOpt.dataset.kelas;
    } else {
        document.getElementById('inputNama').value = "";
        document.getElementById('inputKelas').value = "";
    }
});

// 5. SIMPAN / EDIT ABSENSI
const absensiForm = document.getElementById('absensiForm');
const absensiMessage = document.getElementById('absensiMessage');

absensiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    absensiMessage.innerText = "";
    absensiMessage.className = "message";

    const nama = document.getElementById('inputNama').value.trim();
    const kelas = document.getElementById('inputKelas').value.trim();
    const tanggal = document.getElementById('inputTanggal').value;
    const statusRadio = document.querySelector('input[name="status"]:checked');

    if (!nama || !kelas || !tanggal || !statusRadio) {
        absensiMessage.innerText = "Semua field wajib diisi!";
        absensiMessage.classList.add('error-msg');
        return;
    }

    const status = statusRadio.value;
    const targetUid = currentUserData.role === "siswa" ? auth.currentUser.uid : (document.getElementById('selectSiswa').selectedOptions[0]?.dataset.uid || auth.currentUser.uid);

    try {
        if (editingAbsenId) {
            await updateDoc(doc(db, "absensi", editingAbsenId), {
                nama, kelas, tanggal, status
            });
            absensiMessage.innerText = "Data absensi berhasil diperbarui!";
            absensiMessage.classList.add('success-msg');
            resetFormMode();
        } else {
            // Validasi duplikat khusus siswa (1 kali sehari)
            if (currentUserData.role === "siswa") {
                const qCheck = query(
                    collection(db, "absensi"),
                    where("uid", "==", auth.currentUser.uid),
                    where("tanggal", "==", todayStr)
                );
                const checkSnap = await getDocs(qCheck);
                if (!checkSnap.empty) {
                    absensiMessage.innerText = "Anda sudah melakukan absensi hari ini!";
                    absensiMessage.classList.add('error-msg');
                    return;
                }
            }

            await addDoc(collection(db, "absensi"), {
                nama, kelas, tanggal, status,
                uid: targetUid,
                createdAt: serverTimestamp()
            });

            absensiMessage.innerText = "Absensi berhasil disimpan!";
            absensiMessage.classList.add('success-msg');
            absensiForm.reset();
            if (currentUserData.role === "siswa") {
                document.getElementById('inputNama').value = currentUserData.nama;
                document.getElementById('inputKelas').value = currentUserData.kelas;
                inputTanggalEl.value = todayStr;
            }
        }
    } catch (error) {
        absensiMessage.innerText = "Gagal menyimpan: " + error.message;
        absensiMessage.classList.add('error-msg');
    }
});

// 6. REALTIME DATA & STATISTIK
function loadAbsensiData(role, uid) {
    let q;
    if (role === "admin" || role === "guru") {
        q = collection(db, "absensi");
    } else {
        q = query(collection(db, "absensi"), where("uid", "==", uid));
    }

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('absensiTableBody');
        tbody.innerHTML = "";

        let total = 0, hadir = 0, izin = 0, sakit = 0;

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">Belum ada data absensi.</td></tr>`;
        } else {
            snapshot.forEach((docSnap) => {
                const item = docSnap.data();
                total++;
                if (item.status === "Hadir") hadir++;
                else if (item.status === "Izin") izin++;
                else if (item.status === "Sakit") sakit++;

                let badgeClass = "badge-hadir";
                if (item.status === "Izin") badgeClass = "badge-izin";
                if (item.status === "Sakit") badgeClass = "badge-sakit";

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.nama}</td>
                    <td>${item.kelas}</td>
                    <td>${item.tanggal}</td>
                    <td><span class="badge ${badgeClass}">${item.status}</span></td>
                    ${(role === "admin" || role === "guru") ? `
                        <td>
                            <button onclick="window.prepareEdit('${docSnap.id}', '${item.nama}', '${item.kelas}', '${item.tanggal}', '${item.status}')" class="btn" style="padding:4px 8px; font-size:11px; background:#e0e7ff; color:#3730a3;">Edit</button>
                            <button onclick="window.hapusAbsen('${docSnap.id}')" class="btn btn-danger" style="padding:4px 8px; font-size:11px;">Hapus</button>
                        </td>
                    ` : ''}
                `;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('statTotal').innerText = total;
        document.getElementById('statHadir').innerText = hadir;
        document.getElementById('statIzin').innerText = izin;
        document.getElementById('statSakit').innerText = sakit;
    });
}

window.prepareEdit = function(id, nama, kelas, tanggal, status) {
    editingAbsenId = id;
    document.getElementById('inputNama').value = nama;
    document.getElementById('inputKelas').value = kelas;
    document.getElementById('inputTanggal').value = tanggal;
    document.querySelector(`input[name="status"][value="${status}"]`).checked = true;
    
    document.getElementById('btnSimpanAbsen').innerText = "Perbarui Absensi";
    document.getElementById('btnBatalEdit').classList.remove('hidden');
}

window.hapusAbsen = async function(id) {
    if (confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) {
        await deleteDoc(doc(db, "absensi", id));
    }
}

document.getElementById('btnBatalEdit').addEventListener('click', () => {
    resetFormMode();
    absensiForm.reset();
    if (currentUserData.role === "siswa") {
        document.getElementById('inputNama').value = currentUserData.nama;
        document.getElementById('inputKelas').value = currentUserData.kelas;
        inputTanggalEl.value = todayStr;
    }
});

function resetFormMode() {
    editingAbsenId = null;
    document.getElementById('btnSimpanAbsen').innerText = "Simpan Absensi";
    document.getElementById('btnBatalEdit').classList.add('hidden');
}
