import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate } from '../lib/format';
import type { Patient, PatientGender } from '../types/domain';

const genderLabel: Record<PatientGender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

export function PatientsPage() {
  const patientsQuery = useApiQuery(() => patientsApi.list(), []);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const patients = patientsQuery.data ?? [];
    if (!term) return patients;
    return patients.filter(
      (p) => p.fullName.toLowerCase().includes(term) || p.phone.includes(term),
    );
  }, [patientsQuery.data, search]);

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1>Bệnh nhân</h1>
          <p className="page-subtitle">Tìm kiếm hoặc đăng ký bệnh nhân mới.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)}>
          + Bệnh nhân mới
        </button>
      </div>

      <div className="search-row">
        <label htmlFor="patient-search" className="visually-hidden">
          Tìm bệnh nhân
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Tìm theo tên hoặc số điện thoại"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {patientsQuery.isLoading && <LoadingState />}
      {patientsQuery.error && <ErrorState message={patientsQuery.error} />}
      {!patientsQuery.isLoading && !patientsQuery.error && filtered.length === 0 && (
        <EmptyState message="Không tìm thấy bệnh nhân." />
      )}

      {!patientsQuery.isLoading && !patientsQuery.error && filtered.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Ngày sinh</th>
              <th>Giới tính</th>
              <th>Điện thoại</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.fullName}</td>
                <td>{formatDate(patient.dateOfBirth)}</td>
                <td>{genderLabel[patient.gender]}</td>
                <td>{patient.phone}</td>
                <td>
                  <Link className="btn btn-ghost" to={`/patients/${patient.id}`}>
                    Mở hồ sơ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isCreating && (
        <CreatePatientDialog
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            patientsQuery.reload();
          }}
        />
      )}
    </div>
  );
}

function CreatePatientDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (patient: Patient) => void;
}) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<PatientGender>('MALE');
  const [phone, setPhone] = useState('');

  const [duplicates, setDuplicates] = useState<Patient[] | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCheckDuplicates = fullName.trim().length > 0 && dateOfBirth && phone.trim().length > 0;

  async function checkDuplicates() {
    if (!canCheckDuplicates) return;
    setIsCheckingDuplicates(true);
    setError(null);
    try {
      const candidates = await patientsApi.checkDuplicates({ fullName, dateOfBirth, phone });
      setDuplicates(candidates);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kiểm tra được trùng lặp.');
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await patientsApi.create({ fullName, dateOfBirth, gender, phone });
      onCreated(result.patient);
      navigate(`/patients/${result.patient.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được bệnh nhân.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-patient-title"
      >
        <h2 id="create-patient-title">Đăng ký bệnh nhân mới</h2>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="fullName">Họ tên</label>
          <input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setDuplicates(null);
            }}
          />

          <label htmlFor="dateOfBirth">Ngày sinh</label>
          <input
            id="dateOfBirth"
            type="date"
            required
            value={dateOfBirth}
            onChange={(e) => {
              setDateOfBirth(e.target.value);
              setDuplicates(null);
            }}
          />

          <label htmlFor="gender">Giới tính</label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as PatientGender)}
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>

          <label htmlFor="phone">Điện thoại</label>
          <input
            id="phone"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setDuplicates(null);
            }}
          />

          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canCheckDuplicates || isCheckingDuplicates}
            onClick={checkDuplicates}
          >
            {isCheckingDuplicates ? 'Đang kiểm tra...' : 'Kiểm tra trùng lặp'}
          </button>

          {duplicates && duplicates.length > 0 && (
            <div className="duplicate-warning" role="alert">
              <p>Có thể trùng với bệnh nhân đã có. Vui lòng kiểm tra trước khi tạo mới:</p>
              <ul>
                {duplicates.map((candidate) => (
                  <li key={candidate.id}>
                    {candidate.fullName} — {formatDate(candidate.dateOfBirth)} —{' '}
                    {candidate.phone}{' '}
                    <Link to={`/patients/${candidate.id}`} onClick={onClose}>
                      Mở hồ sơ này
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="duplicate-warning-note">
                Bạn vẫn có thể tạo bệnh nhân mới nếu đây là người khác.
              </p>
            </div>
          )}

          {duplicates && duplicates.length === 0 && (
            <p className="form-hint">Không tìm thấy trùng lặp.</p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Đang tạo...' : 'Tạo bệnh nhân mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
