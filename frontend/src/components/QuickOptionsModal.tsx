import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../services/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import '../styles/QuickOptionsModal.css';

interface VariantItem {
    item_code: string;
    price: number;
    image?: string;
    [attr: string]: any;
}

interface AttrDef {
    attribute: string;
    values: string[];
}

interface VariantData {
    attributes: AttrDef[];
    variants: VariantItem[];
}

interface Props {
    id: string;
    name: string;
    image: string;
    price: string;
    onClose: () => void;
}

const COLOUR_MAP: Record<string, string> = {
    red: '#e53e3e', blue: '#3182ce', green: '#38a169', black: '#1a202c',
    white: '#f7fafc', yellow: '#d69e2e', pink: '#d53f8c', purple: '#805ad5',
    orange: '#dd6b20', brown: '#744210', grey: '#718096', gray: '#718096',
    navy: '#1a365d', maroon: '#702459', teal: '#2c7a7b', cyan: '#0987a0',
    beige: '#d4b896', cream: '#fffdd0', khaki: '#c3b091', olive: '#6b7c3b',
};

function cssColour(name: string): string {
    return COLOUR_MAP[name.toLowerCase()] ?? name.toLowerCase();
}

function isColourAttr(attrName: string): boolean {
    return /colou?r/i.test(attrName);
}

const QuickOptionsModal: React.FC<Props> = ({ id, name, image, price, onClose }) => {
    const { addToCart } = useCart();
    const { showToast } = useToast();

    const [variantData, setVariantData] = useState<VariantData | null>(null);
    const [loading, setLoading] = useState(true);
    // Generic: maps attribute name → selected value (empty string = not yet selected)
    const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api<{ message: VariantData }>(
            `/api/method/store_customizations.api.products.get_item_variants?item_code=${encodeURIComponent(id)}`
        )
            .then(res => {
                if (res.message) {
                    setVariantData(res.message);
                    // Pre-init all attribute keys to empty string
                    const init: Record<string, string> = {};
                    res.message.attributes.forEach(a => { init[a.attribute] = ''; });
                    setSelectedAttrs(init);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!variantData && !loading) {
        // nothing to show
    }

    const attributes = variantData?.attributes ?? [];

    // Values available for `attrName` given every OTHER already-selected attribute
    function availableValues(attrName: string): string[] {
        if (!variantData) return [];
        const otherSelections = Object.entries(selectedAttrs).filter(
            ([k, v]) => k !== attrName && v !== ''
        );
        const matching = variantData.variants.filter(v =>
            otherSelections.every(([k, val]) => v[k] === val)
        );
        const seen = new Set<string>();
        const result: string[] = [];
        for (const v of matching) {
            const val = v[attrName];
            if (val && !seen.has(val)) { seen.add(val); result.push(val); }
        }
        return result;
    }

    function selectAttr(attrName: string, value: string) {
        setSelectedAttrs(prev => {
            const next = { ...prev, [attrName]: value };
            // Clear downstream attributes that no longer have a valid option
            attributes.forEach(a => {
                if (a.attribute === attrName) return;
                // Check if current selection is still valid given new state
                const otherSels = Object.entries(next).filter(
                    ([k, v]) => k !== a.attribute && v !== ''
                );
                const stillValid = variantData?.variants.some(v =>
                    otherSels.every(([k, val]) => v[k] === val) &&
                    v[a.attribute] === next[a.attribute]
                );
                if (!stillValid) next[a.attribute] = '';
            });
            return next;
        });
    }

    // Exact match variant (all attributes selected)
    const activeVariant: VariantItem | null = (() => {
        if (!variantData || attributes.length === 0) return null;
        if (attributes.some(a => !selectedAttrs[a.attribute])) return null;
        return variantData.variants.find(v =>
            attributes.every(a => v[a.attribute] === selectedAttrs[a.attribute])
        ) ?? null;
    })();

    // Partial match for preview image (first variant that matches selected attrs so far)
    const previewVariant: VariantItem | null = (() => {
        if (!variantData) return null;
        const selected = Object.entries(selectedAttrs).filter(([, v]) => v !== '');
        if (selected.length === 0) return null;
        return variantData.variants.find(v =>
            selected.every(([k, val]) => v[k] === val)
        ) ?? null;
    })();

    const displayImage = previewVariant?.image || image;
    const displayPrice = activeVariant
        ? `₹${Number(activeVariant.price).toLocaleString('en-IN')}`
        : price;

    // First attribute not yet selected → use for hint
    const firstUnselected = attributes.find(a => !selectedAttrs[a.attribute]);

    const handleAddToCart = () => {
        if (!activeVariant) return;
        const attrSummary = attributes.map(a => selectedAttrs[a.attribute]).join(', ');
        addToCart({
            id: activeVariant.item_code,
            name: `${name} (${attrSummary})`,
            price: activeVariant.price,
            image: displayImage,
            size: selectedAttrs[attributes.find(a => /size/i.test(a.attribute))?.attribute ?? ''] || 'Default',
            quantity,
        });
        showToast(`${name} added to cart!`, 'success');
        onClose();
    };

    return ReactDOM.createPortal(
        <div
            className="qom-overlay"
            ref={overlayRef}
            onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="qom-sheet">
                {/* Hero image */}
                <div className="qom-hero">
                    <div className="qom-handle" />
                    <img className="qom-hero-img" src={displayImage} alt={name} />
                    <div className="qom-hero-gradient" />
                    <div className="qom-hero-info">
                        <p className="qom-hero-name">{name}</p>
                        <p className="qom-hero-price">{displayPrice}</p>
                    </div>
                    <button className="qom-close" onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Options body */}
                <div className="qom-body">
                    {loading ? (
                        <div className="qom-loading">
                            <div className="qom-spinner" />
                            <p>Loading options…</p>
                        </div>
                    ) : !variantData ? (
                        <p className="qom-error">Could not load options. Please try again.</p>
                    ) : (
                        <>
                            {attributes.map(attr => {
                                const values = availableValues(attr.attribute);
                                const selected = selectedAttrs[attr.attribute];
                                const isColour = isColourAttr(attr.attribute);

                                return (
                                    <div key={attr.attribute} className="qom-section">
                                        <p className="qom-label">
                                            {attr.attribute}
                                            {selected && (
                                                <span className="qom-selected-val">{selected}</span>
                                            )}
                                        </p>

                                        {isColour ? (
                                            <div className="qom-swatches">
                                                {values.map(val => (
                                                    <button
                                                        key={val}
                                                        className={`qom-swatch ${selected === val ? 'active' : ''}`}
                                                        style={{ background: cssColour(val) }}
                                                        title={val}
                                                        onClick={() => selectAttr(attr.attribute, val)}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="qom-sizes">
                                                {values.map(val => (
                                                    <button
                                                        key={val}
                                                        className={`qom-size-btn ${selected === val ? 'active' : ''}`}
                                                        onClick={() => selectAttr(attr.attribute, val)}
                                                    >
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="qom-section">
                                <p className="qom-label">Quantity</p>
                                <div className="qom-qty">
                                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                                    <span>{quantity}</span>
                                    <button onClick={() => setQuantity(q => q + 1)}>+</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!loading && variantData && (
                    <div className="qom-footer">
                        {!activeVariant && firstUnselected && (
                            <p className="qom-hint">
                                Please select a {firstUnselected.attribute.toLowerCase()} to continue
                            </p>
                        )}
                        <button
                            className="qom-add-btn"
                            disabled={!activeVariant}
                            onClick={handleAddToCart}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" />
                            </svg>
                            {activeVariant ? 'Add to Cart' : `Select ${firstUnselected?.attribute ?? 'Options'}`}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default QuickOptionsModal;
