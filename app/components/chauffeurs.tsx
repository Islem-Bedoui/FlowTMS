'use client';
import { useEffect, useState } from 'react';
import DataGrid, { Column } from 'devextreme-react/data-grid';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

const columns = [
  { dataField: 'Name', caption: 'Nom' },
  { dataField: 'address', caption: 'Adresse' },
  { dataField: 'city', caption: 'Ville' },
  { dataField: 'EmploymentDate', caption: 'Date d\'embauche' },
  { dataField: 'jobTitle', caption: 'Titre du poste' },
];

// Interface for chauffeur data
interface Chauffeur {
  No: string;
  Name: string;
  address: string;
  city: string;
  EmploymentDate: string;
  jobTitle: string;
  "@odata.etag": string;
}

const ChauffeurList = () => {
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[] | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedChauffeur, setSelectedChauffeur] = useState<Chauffeur | null>(null);
  const [newChauffeur, setNewChauffeur] = useState<Chauffeur>({
    No: '',
    Name: '',
    address: '',
    city: '',
    EmploymentDate: '',
    jobTitle: '',
    "@odata.etag": '',
  });

  useEffect(() => {
    const fetchChauffeurs = async () => {
      try {
        const response = await fetch('/api/chauffeurs');
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erreur HTTP ${response.status} : ${text}`);
        }
        const data = await response.json();

        const chauffeursList = data.value
          .filter((chauffeur: any) =>
            chauffeur.Name && chauffeur.address && chauffeur.city
          )
          .map((chauffeur: any) => ({
            No: chauffeur.No,
            Name: chauffeur.Name,
            address: chauffeur.address,
            city: chauffeur.city,
            EmploymentDate: chauffeur.EmploymentDate || '',
            jobTitle: chauffeur.jobTitle || '',
            "@odata.etag": chauffeur["@odata.etag"],
          }));

        setChauffeurs(chauffeursList);
      } catch (err) {
        console.error('Erreur lors du chargement des chauffeurs :', err);
      }
    };

    fetchChauffeurs();
  }, []);

  const handleEdit = (chauffeur: Chauffeur) => {
    setSelectedChauffeur(chauffeur);
    setOpenEditDialog(true);
  };

  const handleDelete = async (name: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce chauffeur ?')) return;

    try {
      const chauffeurToDelete = chauffeurs?.find(c => c.Name === name);
      if (!chauffeurToDelete?.No) throw new Error('No not found for deletion');

      const response = await fetch(`/api/chauffeurs?No=${encodeURIComponent(chauffeurToDelete.No)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression du chauffeur');

      setChauffeurs((prev) => prev?.filter((c) => c.No !== chauffeurToDelete.No) || null);
    } catch (err) {
      console.error('Erreur lors de la suppression :', err);
      alert('Erreur lors de la suppression du chauffeur');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedChauffeur) return;

    try {
      if (!selectedChauffeur.No) throw new Error('No not found for update');

      const response = await fetch(`/api/chauffeurs?No=${encodeURIComponent(selectedChauffeur.No)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedChauffeur),
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à jour du chauffeur');

      setChauffeurs((prev) =>
        prev?.map((c) => (c.No === selectedChauffeur.No ? selectedChauffeur : c)) || null
      );
      setOpenEditDialog(false);
      setSelectedChauffeur(null);
    } catch (err) {
      console.error('Erreur lors de la mise à jour :', err);
      alert('Erreur lors de la mise à jour du chauffeur');
    }
  };

  const handleAddChauffeur = async () => {
    if (!newChauffeur.Name || !newChauffeur.address || !newChauffeur.city || !newChauffeur.jobTitle) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const response = await fetch('/api/chauffeurs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newChauffeur),
      });

      if (!response.ok) throw new Error('Erreur lors de l\'ajout du chauffeur');

      const addedChauffeur = await response.json();
      setChauffeurs((prev) => [...(prev || []), addedChauffeur]);
      setOpenAddDialog(false);
      setNewChauffeur({ No: '', Name: '', address: '', city: '', EmploymentDate: '', jobTitle: '', "@odata.etag": '' });
    } catch (err) {
      console.error('Erreur lors de l\'ajout :', err);
      alert('Erreur lors de l\'ajout du chauffeur');
    }
  };

  if (!chauffeurs) return <p>Chargement...</p>;

  return (
    <div className="flex">
      <div className="flex-1 p-6 overflow-auto">
        <div className="p-4 shadow-md bg-white animate-fade-in-up">
          <DataGrid
            dataSource={chauffeurs}
            keyExpr="Name"
            columnAutoWidth={true}
            rowAlternationEnabled={true}
            showBorders={false}
            className="custom-datagrid transition-all duration-500"
            onContentReady={(e) => {
              e.component.updateDimensions();
            }}
          >
            {columns.map((col, index) => (
              <Column
                key={index}
                dataField={col.dataField}
                caption={col.caption}
              />
            ))}
            <Column
              caption="Actions"
              cellRender={(data) => (
                <div className="flex gap-2">
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => handleEdit(data.data)}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => handleDelete(data.data.Name)}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            />
          </DataGrid>
        </div>
        <div className="mt-4">
          <Button
            variant="contained"
            color="success"
            onClick={() => setOpenAddDialog(true)}
          >
            Ajouter un chauffeur
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Modifier Chauffeur</DialogTitle>
        <DialogContent>
          <TextField
            label="No"
            value={selectedChauffeur?.No || ''}
            fullWidth
            margin="normal"
            disabled
          />
          <TextField
            label="Nom"
            value={selectedChauffeur?.Name || ''}
            onChange={(e) =>
              setSelectedChauffeur((prev) => prev ? { ...prev, Name: e.target.value } : null)
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Adresse"
            value={selectedChauffeur?.address || ''}
            onChange={(e) =>
              setSelectedChauffeur((prev) => prev ? { ...prev, address: e.target.value } : null)
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Ville"
            value={selectedChauffeur?.city || ''}
            onChange={(e) =>
              setSelectedChauffeur((prev) => prev ? { ...prev, city: e.target.value } : null)
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Date d'embauche"
            value={selectedChauffeur?.EmploymentDate || ''}
            onChange={(e) =>
              setSelectedChauffeur((prev) => prev ? { ...prev, EmploymentDate: e.target.value } : null)
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Titre du poste"
            value={selectedChauffeur?.jobTitle || ''}
            onChange={(e) =>
              setSelectedChauffeur((prev) => prev ? { ...prev, jobTitle: e.target.value } : null)
            }
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Annuler</Button>
          <Button onClick={handleSaveEdit} color="primary">Sauvegarder</Button>
        </DialogActions>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Ajouter Chauffeur</DialogTitle>
        <DialogContent>
          <TextField
            label="No"
            value={newChauffeur.No}
            fullWidth
            margin="normal"
            disabled
          />
          <TextField
            label="Nom"
            value={newChauffeur.Name}
            onChange={(e) =>
              setNewChauffeur((prev) => ({ ...prev, Name: e.target.value }))
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Adresse"
            value={newChauffeur.address}
            onChange={(e) =>
              setNewChauffeur((prev) => ({ ...prev, address: e.target.value }))
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Ville"
            value={newChauffeur.city}
            onChange={(e) =>
              setNewChauffeur((prev) => ({ ...prev, city: e.target.value }))
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Date d'embauche"
            value={newChauffeur.EmploymentDate}
            onChange={(e) =>
              setNewChauffeur((prev) => ({ ...prev, EmploymentDate: e.target.value }))
            }
            fullWidth
            margin="normal"
          />
          <TextField
            label="Titre du poste"
            value={newChauffeur.jobTitle}
            onChange={(e) =>
              setNewChauffeur((prev) => ({ ...prev, jobTitle: e.target.value }))
            }
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Annuler</Button>
          <Button onClick={handleAddChauffeur} color="primary">Ajouter</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ChauffeurList;


