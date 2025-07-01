
import MapContainer from '../components/MapContainer';
import PhotoViewer from '../components/PhotoViewer';
import usePhotoStore from '../store/photoStore';


function Map() {
    const { selectedPhoto, setSelectedPhoto } = usePhotoStore();

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <MapContainer />
            {/* <PhotoUploader /> */}
            {selectedPhoto && (
                <PhotoViewer
                    photo={selectedPhoto}
                    onClose={() => setSelectedPhoto(null)}
                />
            )}
        </div>
    );
}

export default Map;